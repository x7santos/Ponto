const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

const REGION = "southamerica-east1";
const USERS = admin.firestore().collection("users");

exports.createUserByAdmin = onCall({ region: REGION }, async (request) => {
  try {
    const adminUid = await ensureAdmin(request);
    const data = request.data || {};

    const nome = normalizeTextField(data.nome);
    const email = normalizeEmail(data.email);
    const senha = String(data.senha || "").trim();
    const role = normalizeRole(data.role);
    const departamento = normalizeTextField(data.departamento);
    const cargo = normalizeTextField(data.cargo);

    if (!nome || !email || !senha) {
      throw new HttpsError("invalid-argument", "Nome, e-mail e senha são obrigatórios.");
    }

    if (senha.length < 6) {
      throw new HttpsError("invalid-argument", "A senha deve ter pelo menos 6 caracteres.");
    }

    let createdUser;

    try {
      createdUser = await admin.auth().createUser({
        email,
        password: senha,
        displayName: nome,
        disabled: false
      });
    } catch (error) {
      logger.error("Erro ao criar usuário no Auth", error);

      if (error.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Este e-mail já está em uso.");
      }

      throw new HttpsError("internal", "Não foi possível criar o usuário no Authentication.");
    }

    const uid = createdUser.uid;

    try {
      await USERS.doc(uid).set({
        nome,
        email,
        role,
        departamento,
        cargo,
        ativo: true,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: adminUid,
        atualizadoPor: adminUid
      });
    } catch (error) {
      logger.error("Erro ao salvar documento do usuário", error);
      await safeDeleteUser(uid);
      throw new HttpsError("internal", "Usuário criado no Auth, mas falhou ao salvar no Firestore.");
    }

    return { ok: true, uid, message: "Usuário criado com sucesso." };
  } catch (error) {
    return handleFunctionError("createUserByAdmin", error);
  }
});

exports.updateUserByAdmin = onCall({ region: REGION }, async (request) => {
  try {
    const adminUid = await ensureAdmin(request);
    const data = request.data || {};

    const userId = String(data.userId || "").trim();
    const nome = normalizeTextField(data.nome);
    const email = normalizeEmail(data.email);
    const role = normalizeRole(data.role);
    const departamento = normalizeTextField(data.departamento);
    const cargo = normalizeTextField(data.cargo);

    if (!userId || !nome || !email) {
      throw new HttpsError("invalid-argument", "userId, nome e e-mail são obrigatórios.");
    }

    const userRecord = await admin.auth().getUser(userId).catch(() => null);
    if (!userRecord) {
      throw new HttpsError("not-found", "Usuário não encontrado no Authentication.");
    }

    if (request.auth.uid === userId && role !== "admin") {
      throw new HttpsError("failed-precondition", "Você não pode remover sua própria permissão de administrador.");
    }

    try {
      await admin.auth().updateUser(userId, {
        email,
        displayName: nome
      });
    } catch (error) {
      logger.error("Erro ao atualizar usuário no Auth", error);
      if (error.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Este e-mail já está em uso.");
      }
      throw new HttpsError("internal", "Não foi possível atualizar o Authentication.");
    }

    await USERS.doc(userId).set({
      nome,
      email,
      role,
      departamento,
      cargo,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoPor: adminUid
    }, { merge: true });

    return { ok: true, message: "Usuário atualizado com sucesso." };
  } catch (error) {
    return handleFunctionError("updateUserByAdmin", error);
  }
});

exports.toggleUserStatusByAdmin = onCall({ region: REGION }, async (request) => {
  try {
    const adminUid = await ensureAdmin(request);
    const data = request.data || {};

    const userId = String(data.userId || "").trim();
    const ativo = Boolean(data.ativo);

    if (!userId) {
      throw new HttpsError("invalid-argument", "userId é obrigatório.");
    }

    if (request.auth.uid === userId && ativo === false) {
      throw new HttpsError("failed-precondition", "Você não pode desativar a sua própria conta.");
    }

    await admin.auth().updateUser(userId, { disabled: !ativo });
    await USERS.doc(userId).set({
      ativo,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoPor: adminUid
    }, { merge: true });

    return {
      ok: true,
      ativo,
      message: ativo ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso."
    };
  } catch (error) {
    return handleFunctionError("toggleUserStatusByAdmin", error);
  }
});

async function ensureAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const adminUid = request.auth.uid;
  const adminDoc = await USERS.doc(adminUid).get();

  if (!adminDoc.exists) {
    throw new HttpsError("permission-denied", "Usuário administrador não encontrado na coleção users.");
  }

  const adminData = adminDoc.data() || {};
  if (String(adminData.role || "").toLowerCase() !== "admin") {
    throw new HttpsError("permission-denied", "Apenas administradores podem executar esta ação.");
  }

  if (adminData.ativo === false) {
    throw new HttpsError("permission-denied", "Sua conta administrativa está desativada.");
  }

  return adminUid;
}

function normalizeTextField(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return "";
  return email;
}

function normalizeRole(value) {
  const role = String(value || "funcionario").trim().toLowerCase();
  if (!["admin", "funcionario"].includes(role)) {
    throw new HttpsError("invalid-argument", "Permissão inválida.");
  }
  return role;
}

async function safeDeleteUser(uid) {
  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    logger.error("Erro no rollback ao excluir usuário do Auth", error);
  }
}

function handleFunctionError(scope, error) {
  logger.error(`Erro em ${scope}`, error);
  if (error instanceof HttpsError) throw error;
  throw new HttpsError("internal", "Erro interno no servidor.");
}

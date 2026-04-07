const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

exports.createUserByAdmin = onCall(
  {
    region: "southamerica-east1"
  },
  async (request) => {
    try {
      const auth = request.auth;
      const data = request.data || {};

      if (!auth) {
        throw new HttpsError("unauthenticated", "Usuário não autenticado.");
      }

      const adminUid = auth.uid;

      const adminDocRef = admin.firestore().collection("users").doc(adminUid);
      const adminDocSnap = await adminDocRef.get();

      if (!adminDocSnap.exists) {
        throw new HttpsError("permission-denied", "Seu usuário não possui cadastro na coleção users.");
      }

      const adminData = adminDocSnap.data() || {};

      if (String(adminData.role || "").toLowerCase() !== "admin") {
        throw new HttpsError("permission-denied", "Apenas administradores podem criar usuários.");
      }

      const nome = String(data.nome || "").trim();
      const email = String(data.email || "").trim().toLowerCase();
      const senha = String(data.senha || "").trim();
      const role = String(data.role || "funcionario").trim().toLowerCase();

      if (!nome || !email || !senha) {
        throw new HttpsError("invalid-argument", "Nome, e-mail e senha são obrigatórios.");
      }

      if (!["admin", "funcionario"].includes(role)) {
        throw new HttpsError("invalid-argument", "Permissão inválida.");
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
        logger.error("Erro ao criar usuário no Authentication:", error);

        if (error.code === "auth/email-already-exists") {
          throw new HttpsError("already-exists", "Este e-mail já está em uso.");
        }

        throw new HttpsError("internal", "Não foi possível criar o usuário no Authentication.");
      }

      const newUid = createdUser.uid;

      try {
        await admin.firestore().collection("users").doc(newUid).set({
          nome,
          email,
          role,
          ativo: true,
          criadoEm: admin.firestore.FieldValue.serverTimestamp(),
          criadoPor: adminUid
        });
      } catch (error) {
        logger.error("Erro ao criar documento do usuário no Firestore:", error);

        try {
          await admin.auth().deleteUser(newUid);
        } catch (rollbackError) {
          logger.error("Erro no rollback ao excluir usuário do Auth:", rollbackError);
        }

        throw new HttpsError("internal", "Usuário criado no Auth, mas falhou ao salvar no Firestore.");
      }

      return {
        ok: true,
        message: "Usuário criado com sucesso.",
        uid: newUid
      };
    } catch (error) {
      logger.error("Erro geral em createUserByAdmin:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Erro interno ao criar usuário.");
    }
  }
);

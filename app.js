import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6dti95SJBxgRPt2u1O2pfGRrECjTXzKY",
  authDomain: "ponto-af926.firebaseapp.com",
  projectId: "ponto-af926",
  storageBucket: "ponto-af926.firebasestorage.app",
  messagingSenderId: "880185927479",
  appId: "1:880185927479:web:53df9ce864718bf6501cb2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "southamerica-east1");

const $ = (id) => document.getElementById(id);

const els = {
  loginScreen: $("loginScreen"),
  appScreen: $("appScreen"),
  loginEmail: $("loginEmail"),
  loginPassword: $("loginPassword"),
  btnLogin: $("btnLogin"),
  loginMsg: $("loginMsg"),
  btnForgotPassword: $("btnForgotPassword"),
  forgotPasswordBox: $("forgotPasswordBox"),
  forgotPasswordEmail: $("forgotPasswordEmail"),
  btnSendReset: $("btnSendReset"),
  btnCancelReset: $("btnCancelReset"),
  forgotMsg: $("forgotMsg"),
  btnToggleLoginPassword: $("btnToggleLoginPassword"),

  userInfo: $("userInfo"),
  btnRefresh: $("btnRefresh"),
  btnLogout: $("btnLogout"),
  todayStatusChip: $("todayStatusChip"),

  kpiToday: $("kpiToday"),
  kpiMeMonth: $("kpiMeMonth"),
  kpiActiveUsers: $("kpiActiveUsers"),
  kpiAdmins: $("kpiAdmins"),
  adminKpiUsersCard: $("adminKpiUsersCard"),
  adminKpiAdminsCard: $("adminKpiAdminsCard"),

  tipoPonto: $("tipoPonto"),
  dataReferencia: $("dataReferencia"),
  observacao: $("observacao"),
  btnRegistrarPonto: $("btnRegistrarPonto"),
  btnClearPonto: $("btnClearPonto"),
  pontoMsg: $("pontoMsg"),
  meusPontos: $("meusPontos"),
  searchMyHistory: $("searchMyHistory"),

  adminPanel: $("adminPanel"),
  adminBlocked: $("adminBlocked"),
  adminBadge: $("adminBadge"),
  adminFormTitle: $("adminFormTitle"),
  btnCancelEditUser: $("btnCancelEditUser"),
  novoNome: $("novoNome"),
  novoEmail: $("novoEmail"),
  novoDepartamento: $("novoDepartamento"),
  novoCargo: $("novoCargo"),
  novaSenha: $("novaSenha"),
  passwordFieldWrap: $("passwordFieldWrap"),
  btnToggleNewPassword: $("btnToggleNewPassword"),
  novoRole: $("novoRole"),
  btnCriarUsuario: $("btnCriarUsuario"),
  btnSalvarEdicaoUsuario: $("btnSalvarEdicaoUsuario"),
  adminMsg: $("adminMsg"),
  listaUsuarios: $("listaUsuarios"),
  searchUsers: $("searchUsers"),
  filterRole: $("filterRole"),
  filterStatus: $("filterStatus"),
  todosPontos: $("todosPontos"),
  searchRegistros: $("searchRegistros"),
  filterDateRegistros: $("filterDateRegistros")
};

const state = {
  currentUserData: null,
  allUsers: [],
  myRecords: [],
  allRecords: [],
  editingUserId: null,
  unsubscribes: {
    meusPontos: null,
    todosPontos: null,
    usuarios: null
  }
};

const callable = {
  createUserByAdmin: httpsCallable(functions, "createUserByAdmin"),
  updateUserByAdmin: httpsCallable(functions, "updateUserByAdmin"),
  toggleUserStatusByAdmin: httpsCallable(functions, "toggleUserStatusByAdmin")
};

boot();

function boot() {
  setTodayDefaults();
  bindEvents();
  observeAuth();
}

function bindEvents() {
  els.btnLogin.addEventListener("click", handleLogin);
  els.btnLogout.addEventListener("click", handleLogout);
  els.btnForgotPassword.addEventListener("click", toggleForgotPasswordBox);
  els.btnCancelReset.addEventListener("click", closeForgotPasswordBox);
  els.btnSendReset.addEventListener("click", handlePasswordReset);
  els.btnToggleLoginPassword.addEventListener("click", () => togglePasswordInput(els.loginPassword, els.btnToggleLoginPassword));
  els.btnToggleNewPassword.addEventListener("click", () => togglePasswordInput(els.novaSenha, els.btnToggleNewPassword));
  els.btnRegistrarPonto.addEventListener("click", handleRegisterPonto);
  els.btnClearPonto.addEventListener("click", clearPontoForm);
  els.btnCriarUsuario.addEventListener("click", handleCreateUser);
  els.btnSalvarEdicaoUsuario.addEventListener("click", handleUpdateUser);
  els.btnCancelEditUser.addEventListener("click", resetAdminForm);
  els.btnRefresh.addEventListener("click", refreshVisibleLists);

  els.searchMyHistory.addEventListener("input", renderMyRecords);
  els.searchUsers.addEventListener("input", renderUsers);
  els.filterRole.addEventListener("change", renderUsers);
  els.filterStatus.addEventListener("change", renderUsers);
  els.searchRegistros.addEventListener("input", renderAllRecords);
  els.filterDateRegistros.addEventListener("change", renderAllRecords);

  els.loginPassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleLogin();
  });

  els.listaUsuarios.addEventListener("click", handleUsersListClick);
}

function observeAuth() {
  onAuthStateChanged(auth, async (user) => {
    resetListeners();

    if (!user) {
      state.currentUserData = null;
      state.allUsers = [];
      state.myRecords = [];
      state.allRecords = [];
      resetAdminForm();
      renderMyRecords();
      renderUsers();
      renderAllRecords();
      showScreen("login");
      return;
    }

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (!userSnap.exists()) {
        await signOut(auth);
        setMessage(els.loginMsg, "Seu usuário não existe na coleção users.", "error");
        return;
      }

      state.currentUserData = { uid: user.uid, ...userSnap.data() };

      if (state.currentUserData.ativo === false) {
        await signOut(auth);
        setMessage(els.loginMsg, "Seu acesso está desativado. Procure o administrador.", "error");
        return;
      }

      fillUserHeader();
      showScreen("app");
      applyAdminMode();
      startRealtimeListeners(user.uid);
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
      setMessage(els.loginMsg, getFriendlyError(error), "error");
      await signOut(auth).catch(() => {});
    }
  });
}

async function handleLogin() {
  setMessage(els.loginMsg, "Entrando...");

  try {
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value.trim();

    if (!email || !password) {
      setMessage(els.loginMsg, "Preencha e-mail e senha.", "error");
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    setMessage(els.loginMsg, "");
  } catch (error) {
    console.error("Erro no login:", error);
    setMessage(els.loginMsg, getFriendlyError(error), "error");
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
}

function toggleForgotPasswordBox() {
  els.forgotPasswordBox.classList.toggle("hidden");
  els.forgotPasswordEmail.value = els.loginEmail.value.trim();
  setMessage(els.forgotMsg, "");
}

function closeForgotPasswordBox() {
  els.forgotPasswordBox.classList.add("hidden");
  setMessage(els.forgotMsg, "");
}

async function handlePasswordReset() {
  const email = els.forgotPasswordEmail.value.trim() || els.loginEmail.value.trim();

  if (!email) {
    setMessage(els.forgotMsg, "Informe o e-mail da conta para receber o link.", "error");
    return;
  }

  try {
    setMessage(els.forgotMsg, "Enviando link de redefinição...");
    await sendPasswordResetEmail(auth, email);
    setMessage(els.forgotMsg, "Link de redefinição enviado com sucesso. Verifique seu e-mail.", "success");
  } catch (error) {
    console.error("Erro ao enviar redefinição:", error);
    setMessage(els.forgotMsg, getFriendlyError(error), "error");
  }
}

async function handleRegisterPonto() {
  setMessage(els.pontoMsg, "Salvando registro...");

  try {
    if (!auth.currentUser || !state.currentUserData) {
      setMessage(els.pontoMsg, "Usuário não autenticado.", "error");
      return;
    }

    const now = new Date();
    const dataRef = els.dataReferencia.value || toInputDate(now);
    const [year, month] = dataRef.split("-");

    await addDoc(collection(db, "pontos"), {
      userId: auth.currentUser.uid,
      nome: state.currentUserData.nome,
      email: state.currentUserData.email || auth.currentUser.email,
      departamento: state.currentUserData.departamento || "",
      cargo: state.currentUserData.cargo || "",
      role: state.currentUserData.role || "funcionario",
      tipo: els.tipoPonto.value,
      observacao: els.observacao.value.trim(),
      dataReferencia: dataRef,
      dataTexto: formatDateBR(dataRef),
      horaTexto: now.toLocaleTimeString("pt-BR"),
      mesRef: `${year}-${month}`,
      createdAt: serverTimestamp()
    });

    clearPontoForm(false);
    setMessage(els.pontoMsg, "Ponto registrado com sucesso.", "success");
  } catch (error) {
    console.error("Erro ao registrar ponto:", error);
    setMessage(els.pontoMsg, getFriendlyError(error), "error");
  }
}

function clearPontoForm(resetDate = true) {
  els.tipoPonto.value = "entrada";
  els.observacao.value = "";
  if (resetDate) {
    els.dataReferencia.value = toInputDate(new Date());
  }
  if (resetDate) setMessage(els.pontoMsg, "");
}

async function handleCreateUser() {
  try {
    ensureAdmin();
    setMessage(els.adminMsg, "Criando usuário...");

    const payload = getAdminFormPayload({ requirePassword: true });
    await callable.createUserByAdmin(payload);

    setMessage(els.adminMsg, "Usuário criado com sucesso.", "success");
    resetAdminForm();
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    setMessage(els.adminMsg, getFriendlyError(error), "error");
  }
}

async function handleUpdateUser() {
  try {
    ensureAdmin();

    if (!state.editingUserId) {
      setMessage(els.adminMsg, "Nenhum usuário selecionado para edição.", "error");
      return;
    }

    setMessage(els.adminMsg, "Salvando alterações...");
    const payload = getAdminFormPayload({ requirePassword: false, userId: state.editingUserId });
    await callable.updateUserByAdmin(payload);

    setMessage(els.adminMsg, "Usuário atualizado com sucesso.", "success");
    resetAdminForm();
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    setMessage(els.adminMsg, getFriendlyError(error), "error");
  }
}

function handleUsersListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, uid } = button.dataset;
  const user = state.allUsers.find((item) => item.id === uid);
  if (!user) return;

  if (action === "edit") {
    populateAdminFormForEdit(user);
    return;
  }

  if (action === "toggle") {
    toggleUserStatus(user);
    return;
  }
}

async function toggleUserStatus(user) {
  try {
    ensureAdmin();
    setMessage(els.adminMsg, user.ativo === false ? "Reativando usuário..." : "Desativando usuário...");

    await callable.toggleUserStatusByAdmin({
      userId: user.id,
      ativo: !(user.ativo === true)
    });

    setMessage(
      els.adminMsg,
      user.ativo === false ? "Usuário reativado com sucesso." : "Usuário desativado com sucesso.",
      "success"
    );
  } catch (error) {
    console.error("Erro ao alterar status do usuário:", error);
    setMessage(els.adminMsg, getFriendlyError(error), "error");
  }
}

function getAdminFormPayload({ requirePassword, userId = null }) {
  const nome = els.novoNome.value.trim();
  const email = els.novoEmail.value.trim().toLowerCase();
  const departamento = els.novoDepartamento.value.trim();
  const cargo = els.novoCargo.value.trim();
  const role = els.novoRole.value.trim().toLowerCase();
  const senha = els.novaSenha.value.trim();

  if (!nome || !email) {
    throw new Error("Preencha nome e e-mail.");
  }

  if (requirePassword && senha.length < 6) {
    throw new Error("A senha inicial precisa ter no mínimo 6 caracteres.");
  }

  if (!["admin", "funcionario"].includes(role)) {
    throw new Error("Permissão inválida.");
  }

  return {
    userId,
    nome,
    email,
    departamento,
    cargo,
    role,
    ...(requirePassword ? { senha } : {})
  };
}

function populateAdminFormForEdit(user) {
  state.editingUserId = user.id;
  els.adminFormTitle.textContent = `Editando: ${user.nome || user.email}`;
  els.novoNome.value = user.nome || "";
  els.novoEmail.value = user.email || "";
  els.novoDepartamento.value = user.departamento || "";
  els.novoCargo.value = user.cargo || "";
  els.novoRole.value = user.role || "funcionario";
  els.novaSenha.value = "";
  els.passwordFieldWrap.classList.add("hidden");
  els.btnCriarUsuario.classList.add("hidden");
  els.btnSalvarEdicaoUsuario.classList.remove("hidden");
  els.btnCancelEditUser.classList.remove("hidden");
  setMessage(els.adminMsg, "Modo de edição ativo.");
}

function resetAdminForm() {
  state.editingUserId = null;
  els.adminFormTitle.textContent = "Criar novo acesso";
  els.novoNome.value = "";
  els.novoEmail.value = "";
  els.novoDepartamento.value = "";
  els.novoCargo.value = "";
  els.novoRole.value = "funcionario";
  els.novaSenha.value = "";
  els.passwordFieldWrap.classList.remove("hidden");
  els.btnCriarUsuario.classList.remove("hidden");
  els.btnSalvarEdicaoUsuario.classList.add("hidden");
  els.btnCancelEditUser.classList.add("hidden");
  setMessage(els.adminMsg, "");
}

function ensureAdmin() {
  if (!state.currentUserData || String(state.currentUserData.role).toLowerCase() !== "admin") {
    throw new Error("Somente administradores podem executar esta ação.");
  }
}

function startRealtimeListeners(uid) {
  const qMeusPontos = query(
    collection(db, "pontos"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );

  state.unsubscribes.meusPontos = onSnapshot(qMeusPontos, (snapshot) => {
    state.myRecords = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    renderMyRecords();
    fillPersonalStats();
  }, handleRealtimeError);

  if (String(state.currentUserData?.role).toLowerCase() === "admin") {
    const qUsers = query(collection(db, "users"), orderBy("nome"));
    state.unsubscribes.usuarios = onSnapshot(qUsers, (snapshot) => {
      state.allUsers = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      renderUsers();
      fillAdminStats();
    }, handleRealtimeError);

    const qPontos = query(collection(db, "pontos"), orderBy("createdAt", "desc"));
    state.unsubscribes.todosPontos = onSnapshot(qPontos, (snapshot) => {
      state.allRecords = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      renderAllRecords();
      fillGlobalStats();
    }, handleRealtimeError);
  } else {
    state.allUsers = [];
    state.allRecords = [];
    fillGlobalStats();
    fillAdminStats();
  }
}

function handleRealtimeError(error) {
  console.error("Erro em listener:", error);
}

function renderMyRecords() {
  const search = normalizeText(els.searchMyHistory.value);
  const records = state.myRecords.filter((record) => {
    const haystack = normalizeText(`${record.tipo} ${record.observacao} ${record.dataTexto} ${record.horaTexto}`);
    return haystack.includes(search);
  });

  renderRecordsList({
    container: els.meusPontos,
    records,
    emptyTitle: "Nenhum registro encontrado",
    emptySubtitle: "Seu histórico aparecerá aqui assim que você bater o primeiro ponto."
  });

  updateTodayStatus(records);
}

function renderAllRecords() {
  const search = normalizeText(els.searchRegistros.value);
  const dateFilter = els.filterDateRegistros.value;

  const records = state.allRecords.filter((record) => {
    const haystack = normalizeText(`${record.nome} ${record.email} ${record.observacao} ${record.tipo}`);
    const matchesSearch = haystack.includes(search);
    const matchesDate = !dateFilter || record.dataReferencia === dateFilter;
    return matchesSearch && matchesDate;
  });

  renderRecordsList({
    container: els.todosPontos,
    records,
    emptyTitle: "Nenhum registro operacional",
    emptySubtitle: "Os registros em tempo real dos colaboradores aparecerão aqui."
  });

  fillGlobalStats();
}

function renderRecordsList({ container, records, emptyTitle, emptySubtitle }) {
  container.innerHTML = "";

  if (!records.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h4>${emptyTitle}</h4>
        <p class="muted">${emptySubtitle}</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  records.forEach((record) => {
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-head">
        <div>
          <span class="record-type">${friendlyTipo(record.tipo)}</span>
          <strong>${escapeHtml(record.nome || "Sem nome")}</strong>
        </div>
        <div class="record-meta">
          <span>${escapeHtml(record.dataTexto || "-")}</span>
          <span>${escapeHtml(record.horaTexto || "-")}</span>
        </div>
      </div>
      <p><strong>E-mail:</strong> ${escapeHtml(record.email || "-")}</p>
      <p><strong>Departamento:</strong> ${escapeHtml(record.departamento || "Não informado")}</p>
      <p><strong>Observação:</strong> ${escapeHtml(record.observacao || "Sem observação")}</p>
    `;
    fragment.appendChild(article);
  });

  container.appendChild(fragment);
}

function renderUsers() {
  els.listaUsuarios.innerHTML = "";

  const search = normalizeText(els.searchUsers.value);
  const roleFilter = els.filterRole.value;
  const statusFilter = els.filterStatus.value;

  const users = state.allUsers.filter((user) => {
    const haystack = normalizeText(`${user.nome} ${user.email} ${user.departamento} ${user.cargo}`);
    const matchesSearch = haystack.includes(search);
    const matchesRole = roleFilter === "todos" || String(user.role) === roleFilter;
    const isActive = user.ativo !== false;
    const matchesStatus =
      statusFilter === "todos" ||
      (statusFilter === "ativos" && isActive) ||
      (statusFilter === "inativos" && !isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (!users.length) {
    els.listaUsuarios.innerHTML = `
      <div class="empty-state compact">
        <h4>Nenhum usuário localizado</h4>
        <p class="muted">Ajuste os filtros ou cadastre um novo acesso.</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  users.forEach((user) => {
    const article = document.createElement("article");
    article.className = "user-card";

    const isCurrentUser = state.currentUserData?.uid === user.id;
    const isActive = user.ativo !== false;

    article.innerHTML = `
      <div class="user-card-head">
        <div>
          <strong>${escapeHtml(user.nome || "Sem nome")}</strong>
          <p>${escapeHtml(user.email || "-")}</p>
        </div>
        <div class="record-meta">
          <span class="role-tag">${escapeHtml(user.role || "funcionario")}</span>
          <span class="status-tag ${isActive ? "active" : "inactive"}">${isActive ? "Ativo" : "Inativo"}</span>
        </div>
      </div>
      <p><strong>Departamento:</strong> ${escapeHtml(user.departamento || "Não informado")}</p>
      <p><strong>Cargo:</strong> ${escapeHtml(user.cargo || "Não informado")}</p>
      <div class="user-card-actions">
        <button class="btn ghost" type="button" data-action="edit" data-uid="${user.id}">Editar</button>
        <button class="btn ${isActive ? "danger" : "secondary"}" type="button" data-action="toggle" data-uid="${user.id}" ${isCurrentUser ? "disabled" : ""}>
          ${isActive ? "Desativar acesso" : "Reativar acesso"}
        </button>
      </div>
    `;

    fragment.appendChild(article);
  });

  els.listaUsuarios.appendChild(fragment);
}

function applyAdminMode() {
  const isAdmin = String(state.currentUserData?.role).toLowerCase() === "admin";

  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin);
  });

  els.adminBlocked.classList.toggle("hidden", isAdmin);
  els.adminBadge.classList.toggle("hidden", !isAdmin);
  els.adminKpiUsersCard.classList.toggle("hidden", !isAdmin);
  els.adminKpiAdminsCard.classList.toggle("hidden", !isAdmin);
}

function fillUserHeader() {
  const user = state.currentUserData;
  const details = [user.nome, user.role, user.departamento].filter(Boolean).join(" • ");
  els.userInfo.textContent = `Logado como: ${details}`;
}

function fillPersonalStats() {
  const currentMonth = toMonthKey(new Date());
  const monthRecords = state.myRecords.filter((record) => record.mesRef === currentMonth || record.dataReferencia?.startsWith(currentMonth));
  els.kpiMeMonth.textContent = String(monthRecords.length);
}

function fillAdminStats() {
  const activeUsers = state.allUsers.filter((user) => user.ativo !== false).length;
  const admins = state.allUsers.filter((user) => String(user.role) === "admin").length;
  els.kpiActiveUsers.textContent = String(activeUsers);
  els.kpiAdmins.textContent = String(admins);
}

function fillGlobalStats() {
  const today = toInputDate(new Date());
  const todayCount = state.allRecords.filter((record) => record.dataReferencia === today).length;
  els.kpiToday.textContent = String(todayCount);
}

function updateTodayStatus(records = state.myRecords) {
  const today = toInputDate(new Date());
  const todayRecords = records.filter((record) => record.dataReferencia === today);

  if (!todayRecords.length) {
    els.todayStatusChip.textContent = "Sem registro hoje";
    return;
  }

  const lastRecord = todayRecords[0];
  els.todayStatusChip.textContent = `Último: ${friendlyTipo(lastRecord.tipo)} às ${lastRecord.horaTexto || "--:--"}`;
}

function refreshVisibleLists() {
  renderMyRecords();
  renderUsers();
  renderAllRecords();
  fillPersonalStats();
  fillAdminStats();
  fillGlobalStats();
}

function resetListeners() {
  Object.keys(state.unsubscribes).forEach((key) => {
    const unsubscribe = state.unsubscribes[key];
    if (typeof unsubscribe === "function") unsubscribe();
    state.unsubscribes[key] = null;
  });
}

function showScreen(screenName) {
  els.loginScreen.classList.remove("active");
  els.appScreen.classList.remove("active");
  if (screenName === "login") els.loginScreen.classList.add("active");
  if (screenName === "app") els.appScreen.classList.add("active");
}

function setTodayDefaults() {
  els.dataReferencia.value = toInputDate(new Date());
}

function togglePasswordInput(input, button) {
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  button.textContent = isPassword ? "Ocultar" : "Mostrar";
}

function setMessage(element, text, type = "") {
  element.textContent = text || "";
  element.classList.remove("success", "error");
  if (type) element.classList.add(type);
}

function getFriendlyError(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  if (message === "Preencha nome e e-mail.") return message;
  if (message.includes("Somente administradores")) return message;
  if (message.includes("mínimo 6 caracteres")) return message;
  if (code.includes("already-exists")) return "Este e-mail já está em uso.";
  if (code.includes("unauthenticated")) return "Você precisa estar logado para continuar.";
  if (code.includes("permission-denied")) return "Você não tem permissão para executar esta ação.";
  if (code.includes("invalid-argument")) return message || "Dados inválidos.";
  if (code.includes("auth/invalid-credential")) return "E-mail ou senha inválidos.";
  if (code.includes("auth/invalid-email")) return "Digite um e-mail válido.";
  if (code.includes("auth/missing-email")) return "Informe o e-mail da conta.";
  if (code.includes("auth/user-not-found")) return "Nenhum usuário encontrado com esse e-mail.";
  if (code.includes("auth/too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (code.includes("unavailable")) return "Sem conexão com o Firebase no momento.";

  return message || "Ocorreu um erro inesperado.";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[^\w\s@.-]/g, "")
    .toLowerCase();
}

function formatDateBR(dateString) {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

function toInputDate(date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function toMonthKey(date) {
  return toInputDate(date).slice(0, 7);
}

function friendlyTipo(tipo) {
  const map = {
    entrada: "Entrada",
    saida_almoco: "Saída almoço",
    retorno_almoco: "Retorno almoço",
    saida: "Saída"
  };
  return map[tipo] || "Registro";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

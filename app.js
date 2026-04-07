// =============================
// IMPORTS FIREBASE
// =============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// =============================
// CONFIG FIREBASE
// COLE SEUS DADOS AQUI
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyD6dti95SJBxgRPt2u1O2pfGRrECjTXzKY",
  authDomain: "ponto-af926.firebaseapp.com",
  projectId: "ponto-af926",
  storageBucket: "ponto-af926.firebasestorage.app",
  messagingSenderId: "880185927479",
  appId: "1:880185927479:web:53df9ce864718bf6501cb2"
};

// =============================
// INICIALIZAÇÃO
// =============================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =============================
// ELEMENTOS
// =============================
const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const btnLogin = document.getElementById("btnLogin");
const loginMsg = document.getElementById("loginMsg");

const userInfo = document.getElementById("userInfo");
const btnLogout = document.getElementById("btnLogout");

const tipoPonto = document.getElementById("tipoPonto");
const observacao = document.getElementById("observacao");
const btnRegistrarPonto = document.getElementById("btnRegistrarPonto");
const pontoMsg = document.getElementById("pontoMsg");
const meusPontos = document.getElementById("meusPontos");

const adminArea = document.getElementById("adminArea");
const adminBlocked = document.getElementById("adminBlocked");
const adminBadge = document.getElementById("adminBadge");

const novoNome = document.getElementById("novoNome");
const novoEmail = document.getElementById("novoEmail");
const novaSenha = document.getElementById("novaSenha");
const novoRole = document.getElementById("novoRole");
const btnCriarUsuario = document.getElementById("btnCriarUsuario");
const adminMsg = document.getElementById("adminMsg");

const listaUsuarios = document.getElementById("listaUsuarios");
const todosPontos = document.getElementById("todosPontos");

// =============================
// ESTADO
// =============================
let currentUserData = null;
let unsubscribeMeusPontos = null;
let unsubscribeTodosPontos = null;
let unsubscribeUsuarios = null;

// =============================
// FUNÇÕES AUXILIARES
// =============================
function showScreen(screen) {
  loginScreen.classList.remove("active");
  appScreen.classList.remove("active");
  screen.classList.add("active");
}

function formatDateTime(timestamp) {
  if (!timestamp) return "Sem data";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString("pt-BR");
}

function clearAdminForm() {
  novoNome.value = "";
  novoEmail.value = "";
  novaSenha.value = "";
  novoRole.value = "funcionario";
}

function createListItem(html) {
  const div = document.createElement("div");
  div.className = "list-item";
  div.innerHTML = html;
  return div;
}

// =============================
// LOGIN
// =============================
btnLogin.addEventListener("click", async () => {
  loginMsg.textContent = "Entrando...";

  try {
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
      loginMsg.textContent = "Preencha e-mail e senha.";
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    loginMsg.textContent = "";
  } catch (error) {
    console.error(error);
    loginMsg.textContent = "Erro ao fazer login.";
  }
});

// =============================
// LOGOUT
// =============================
btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
  }
});

// =============================
// AUTH STATE
// =============================
onAuthStateChanged(auth, async (user) => {
  resetListeners();

  if (!user) {
    currentUserData = null;
    showScreen(loginScreen);
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      userInfo.textContent = "Usuário sem cadastro na coleção users.";
      showScreen(appScreen);
      return;
    }

    currentUserData = {
      uid: user.uid,
      ...userSnap.data()
    };

    userInfo.textContent = `Logado como: ${currentUserData.nome} • ${currentUserData.role}`;
    showScreen(appScreen);

    listenMeusPontos(user.uid);

    if (currentUserData.role === "admin") {
      enableAdmin();
    } else {
      disableAdmin();
    }
  } catch (error) {
    console.error(error);
  }
});

// =============================
// REGISTRAR PONTO
// =============================
btnRegistrarPonto.addEventListener("click", async () => {
  pontoMsg.textContent = "Salvando...";

  try {
    if (!auth.currentUser || !currentUserData) {
      pontoMsg.textContent = "Usuário não autenticado.";
      return;
    }

    const now = new Date();

    await addDoc(collection(db, "pontos"), {
      userId: auth.currentUser.uid,
      nome: currentUserData.nome,
      email: currentUserData.email || auth.currentUser.email,
      tipo: tipoPonto.value,
      observacao: observacao.value.trim(),
      dataTexto: now.toLocaleDateString("pt-BR"),
      horaTexto: now.toLocaleTimeString("pt-BR"),
      createdAt: serverTimestamp()
    });

    observacao.value = "";
    pontoMsg.textContent = "Ponto registrado com sucesso.";
  } catch (error) {
    console.error(error);
    pontoMsg.textContent = "Erro ao registrar ponto.";
  }
});

// =============================
// OUVIR MEUS PONTOS
// =============================
function listenMeusPontos(uid) {
  const q = query(
    collection(db, "pontos"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );

  unsubscribeMeusPontos = onSnapshot(q, (snapshot) => {
    meusPontos.innerHTML = "";

    if (snapshot.empty) {
      meusPontos.innerHTML = `<div class="list-item">Nenhum ponto registrado ainda.</div>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const item = createListItem(`
        <strong>${data.tipo?.toUpperCase() || "REGISTRO"}</strong>
        <span>Nome: ${data.nome || "-"}</span><br>
        <span>Data: ${data.dataTexto || "-"}</span><br>
        <span>Hora: ${data.horaTexto || "-"}</span><br>
        <span>Observação: ${data.observacao || "Sem observação"}</span>
      `);
      meusPontos.appendChild(item);
    });
  });
}

// =============================
// ADMIN
// =============================
function enableAdmin() {
  adminArea.classList.remove("hidden");
  adminBlocked.classList.add("hidden");
  adminBadge.classList.remove("hidden");
  listenUsuarios();
  listenTodosPontos();
}

function disableAdmin() {
  adminArea.classList.add("hidden");
  adminBlocked.classList.remove("hidden");
  adminBadge.classList.add("hidden");
}

btnCriarUsuario.addEventListener("click", async () => {
  adminMsg.textContent = "Criando usuário...";

  try {
    if (!currentUserData || currentUserData.role !== "admin") {
      adminMsg.textContent = "Sem permissão.";
      return;
    }

    const nome = novoNome.value.trim();
    const email = novoEmail.value.trim();
    const senha = novaSenha.value.trim();
    const role = novoRole.value;

    if (!nome || !email || !senha) {
      adminMsg.textContent = "Preencha nome, e-mail e senha.";
      return;
    }

    // IMPORTANTE:
    // createUserWithEmailAndPassword troca a sessão para o novo usuário criado.
    // Em produção, o ideal é criar usuário via Cloud Functions/Admin SDK.
    // Aqui estou te entregando a base funcional para teste.

    const adminEmailAtual = auth.currentUser.email;
    const adminSenhaAtual = prompt("Digite novamente sua senha de admin para continuar:");

    if (!adminSenhaAtual) {
      adminMsg.textContent = "Criação cancelada.";
      return;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const novoUid = userCredential.user.uid;

    await setDoc(doc(db, "users", novoUid), {
      nome,
      email,
      role,
      ativo: true,
      criadoEm: serverTimestamp()
    });

    adminMsg.textContent = "Usuário criado com sucesso.";
    clearAdminForm();

    // Faz logout do usuário recém-criado e reloga no admin
    await signOut(auth);
    await signInWithEmailAndPassword(auth, adminEmailAtual, adminSenhaAtual);

  } catch (error) {
    console.error(error);
    adminMsg.textContent = "Erro ao criar usuário.";
  }
});

function listenUsuarios() {
  const q = query(collection(db, "users"));

  unsubscribeUsuarios = onSnapshot(q, (snapshot) => {
    listaUsuarios.innerHTML = "";

    if (snapshot.empty) {
      listaUsuarios.innerHTML = `<div class="list-item">Nenhum usuário cadastrado.</div>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const user = docSnap.data();
      const item = createListItem(`
        <div class="user-row">
          <div>
            <strong>${user.nome || "Sem nome"}</strong>
            <span>${user.email || "-"}</span>
          </div>
          <span class="role-tag">${user.role || "funcionario"}</span>
        </div>
      `);
      listaUsuarios.appendChild(item);
    });
  });
}

function listenTodosPontos() {
  const q = query(collection(db, "pontos"), orderBy("createdAt", "desc"));

  unsubscribeTodosPontos = onSnapshot(q, (snapshot) => {
    todosPontos.innerHTML = "";

    if (snapshot.empty) {
      todosPontos.innerHTML = `<div class="list-item">Nenhum registro encontrado.</div>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const p = docSnap.data();
      const item = createListItem(`
        <strong>${p.nome || "Sem nome"} • ${p.tipo?.toUpperCase() || "REGISTRO"}</strong>
        <span>E-mail: ${p.email || "-"}</span><br>
        <span>Data: ${p.dataTexto || "-"}</span><br>
        <span>Hora: ${p.horaTexto || "-"}</span><br>
        <span>Observação: ${p.observacao || "Sem observação"}</span>
      `);
      todosPontos.appendChild(item);
    });
  });
}

function resetListeners() {
  if (unsubscribeMeusPontos) {
    unsubscribeMeusPontos();
    unsubscribeMeusPontos = null;
  }

  if (unsubscribeTodosPontos) {
    unsubscribeTodosPontos();
    unsubscribeTodosPontos = null;
  }

  if (unsubscribeUsuarios) {
    unsubscribeUsuarios();
    unsubscribeUsuarios = null;
  }
}

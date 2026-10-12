import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc, orderBy, query, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA6uhTxtZRCRWfsN7hL1rB3aFosMn2jRc",
    authDomain: "gb-casual.firebaseapp.com",
    projectId: "gb-casual",
    storageBucket: "gb-casual.firebasestorage.app",
    messagingSenderId: "896499619613",
    appId: "1:896499619613:web:94d618f034158ef6c133f4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = null;
let localPatients = [];
let localStock = [];
let localVentes = [];
let localDepenses = [];
let localEmployes = [];
let currentPeriod = 'jour';
let currentReceiptText = "";

document.getElementById('pDate').value = new Date().toISOString().split('T')[0];

window.setRdvShortcut = (days) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    document.getElementById('pProchainRdv').value = targetDate.toISOString().split('T')[0];
};

async function getAdminCodeFromDB() {
    try {
        const docSnap = await getDoc(doc(db, "parametres", "securite"));
        if (docSnap.exists() && docSnap.data().adminCode) {
            return docSnap.data().adminCode;
        }
    } catch (e) {}
    return "9999";
}

// Connexion
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('userCode').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.style.display = 'none';

    const currentAdminCode = await getAdminCodeFromDB();
    if (code === currentAdminCode) {
        currentUser = { nom: "Administrateur", role: "admin" };
        lancerApplication();
        return;
    }

    try {
        const empSnap = await getDocs(collection(db, "employes"));
        let userFound = null;
        empSnap.forEach(d => {
            if (d.data().code === code) {
                userFound = { nom: d.data().nom, role: "employe" };
            }
        });

        if (userFound) {
            currentUser = userFound;
            lancerApplication();
        } else {
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        errorMsg.style.display = 'block';
    }
});

// Changement du code Admin
document.getElementById('changeAdminCodeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newCode = document.getElementById('newAdminCode').value.trim();
    if (!newCode) return;

    try {
        await setDoc(doc(db, "parametres", "securite"), { adminCode: newCode });
        alert("Code secret Administrateur modifié avec succès !");
        document.getElementById('newAdminCode').value = '';
    } catch (err) {
        alert("Erreur lors de la modification du code.");
    }
});

function lancerApplication() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('appScreen').classList.add('active');
    document.getElementById('userInfoDisplay').textContent = currentUser.nom + " (" + (currentUser.role === 'admin' ? 'Entrepreneur' : 'Employé') + ")";
    
    if(currentUser.role === 'admin') {
        document.getElementById('btnTabAdmin').style.display = "inline-block";
        document.getElementById('btnTabDepenses').style.display = "inline-block";
        document.getElementById('adminFinanceCards').style.display = "block";
        document.getElementById('adminStockSection').style.display = "block";
        document.getElementById('employeStockMessage').style.display = "none";
        document.getElementById('titleRecettes').textContent = "Historique Général des Recettes";
        chargerEmployes();
    } else {
        document.getElementById('btnTabAdmin').style.display = "none";
        document.getElementById('btnTabDepenses').style.display = "none";
        document.getElementById('adminFinanceCards').style.display = "none";
        document.getElementById('adminStockSection').style.display = "none";
        document.getElementById('employeStockMessage').style.display = "block";
        document.getElementById('titleRecettes').textContent = "Mes Ventes de la Journée";
    }
    
    chargerVentes();
    if(currentUser.role === 'admin') chargerDepenses();
    chargerPatients();
    chargerStock();
    if(currentUser.role === 'admin') chargerMouvementsStock();
}

window.deconnecter = () => { location.reload(); };

window.switchTab = (tab) => {
    document.querySelectorAll('.section-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    if (tab === 'ventes') {
        document.getElementById('paneVentes').classList.add('active');
        document.getElementById('btnTabVentes').classList.add('active');
        chargerVentes();
    } else if (tab === 'depenses' && currentUser.role === 'admin') {
        document.getElementById('paneDepenses').classList.add('active');
        document.getElementById('btnTabDepenses').classList.add('active');
        chargerDepenses();
    } else if (tab === 'patients') {
        document.getElementById('panePatients').classList.add('active');
        document.getElementById('btnTabPatients').classList.add('active');
        chargerPatients();
    } else if (tab === 'stock') {
        document.getElementById('paneStock').classList.add('active');
        document.getElementById('btnTabStock').classList.add('active');
        chargerStock();
        if(currentUser.role === 'admin') chargerMouvementsStock();
    } else if (tab === 'admin' && currentUser.role === 'admin') {
        document.getElementById('paneAdmin').classList.add('active');
        document.getElementById('btnTabAdmin').classList.add('active');
    }
};

window.switchSubTab = (sub) => {
    document.getElementById('subPaneForm').style.display = sub === 'form' ? 'block' : 'none';
    document.getElementById('subPaneList').style.display = sub === 'list' ? 'block' : 'none';
    
    document.getElementById('btnSubNew').classList.toggle('active', sub === 'form');
    document.getElementById('btnSubList').classList.toggle('active', sub === 'list');

    if(sub === 'list') chargerPatients();
};

window.filtrerPeriode = (p) => {
    currentPeriod = p;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    if(p === 'jour') document.getElementById('pBtnJour').classList.add('active');
    if(p === 'semaine') document.getElementById('pBtnSemaine').classList.add('active');
    if(p === 'mois') document.getElementById('pBtnMois').classList.add('active');
    calculerRapportFinancier();
};

window.reinitialiserFiltreDate = () => {
    document.getElementById('filtreDateSpecifique').value = '';
    chargerVentes();
};

// Stock
document.getElementById('stockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(currentUser.role !== 'admin') return;

    const nomP = document.getElementById('stockNom').value;
    const qteP = Number(document.getElementById('stockQte').value);

    try {
        await addDoc(collection(db, "stock"), {
            pole: document.getElementById('stockPole').value,
            nom: nomP,
            prix: Number(document.getElementById('stockPrix').value),
            qte: qteP
        });

        await addDoc(collection(db, "mouvements_stock"), {
            texte: "➕ Ajout de " + qteP + " unités de " + nomP,
            date: new Date().toLocaleString('fr-FR'),
            createdAt: serverTimestamp()
        });

        alert("Produit ajouté au stock !");
        e.target.reset();
        chargerStock();
        chargerMouvementsStock();
    } catch (err) { alert("Erreur d'ajout au stock."); }
});

async function chargerStock() {
    try {
        const snap = await getDocs(collection(db, "stock"));
        localStock = [];
        let html = "";
        let alertItems = [];
        let selectOptions = '<option value="">-- Choix libre / Hors stock --</option>';

        snap.forEach(d => {
            const st = { id: d.id, ...d.data() };
            localStock.push(st);

            const isLow = st.qte <= 3;
            if (isLow) alertItems.push(st);

            const badgeClass = isLow ? 'badge-stock low' : 'badge-stock ok';
            const badgeText = isLow ? '⚠️ Stock Critique (' + st.qte + ' restants)' : '🟢 En Stock (' + st.qte + ')';
            const itemClass = isLow ? 'stock-item low' : 'stock-item';
            
            html += '<div class="' + itemClass + '"><div><strong>' + st.nom + '</strong> (' + (st.pole === 'gb' ? '🛍️ GB Casual' : '🌿 Glory Herbal') + ')<br><small style="color:#64748b;">Prix : ' + st.prix.toLocaleString() + ' F</small></div><div><span class="' + badgeClass + '">' + badgeText + '</span></div></div>';

            selectOptions += '<option value="' + st.id + '">' + st.nom + ' - ' + st.prix + ' FCFA (Stock: ' + st.qte + ')</option>';
        });

        const banner = document.getElementById('stockDashboardBanner');
        const listContainer = document.getElementById('stockDashboardListContainer');

        if (alertItems.length > 0) {
            let dashHtml = "";
            alertItems.forEach(item => {
                const btnReappro = currentUser.role === 'admin' 
                    ? `<button type="button" class="btn-reappro" onclick="reapprovisionnerRapide('${item.id}', '${item.nom}', ${item.qte})">➕ Réapprovisionner (+5)</button>` 
                    : `<span style="color:#dc2626; font-weight:bold; font-size:11px;">⚠️ Alerte à transmettre</span>`;

                dashHtml += `
                    <div class="stock-alert-item">
                        <div>
                            <strong>${item.nom}</strong> (${item.pole === 'gb' ? '🛍️ GB' : '🌿 GH'})<br>
                            <small style="color:#991b1b; font-weight:bold;">Restant : ${item.qte} unité(s)</small>
                        </div>
                        ${btnReappro}
                    </div>
                `;
            });
            listContainer.innerHTML = dashHtml;
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }

        if(currentUser.role === 'admin') {
            document.getElementById('stockContainer').innerHTML = html || "<p style='text-align:center;'>Aucun produit en stock.</p>";
        }
        document.getElementById('selectStockVente').innerHTML = selectOptions;
    } catch (err) {}
}

window.reapprovisionnerRapide = async (id, nom, qteActuelle) => {
    if(currentUser.role !== 'admin') return;
    const ajout = 5;
    const nouvelleQte = qteActuelle + ajout;
    try {
        await setDoc(doc(db, "stock", id), { qte: nouvelleQte }, { merge: true });

        await addDoc(collection(db, "mouvements_stock"), {
            texte: "📦 Réapprovisionnement rapide (+5) de " + nom + " (Stock actuel: " + nouvelleQte + ")",
            date: new Date().toLocaleString('fr-FR'),
            createdAt: serverTimestamp()
        });

        alert("Stock réapprovisionné de +5 unités pour " + nom + " !");
        chargerStock();
        chargerMouvementsStock();
    } catch (err) {
        alert("Erreur lors de la mise à jour du stock.");
    }
};

async function chargerMouvementsStock() {
    try {
        const snap = await getDocs(query(collection(db, "mouvements_stock"), orderBy("createdAt", "desc")));
        let html = "";
        snap.forEach(d => {
            const m = d.data();
            html += '<div class="stock-log-item"><strong>' + m.date + '</strong> - ' + m.texte + '</div>';
        });
        document.getElementById('stockLogsContainer').innerHTML = html || "<p style='font-size:11px;'>Aucun mouvement enregistré.</p>";
    } catch(e){}
}

window.remplirPrixStock = () => {
    const stockId = document.getElementById('selectStockVente').value;
    const item = localStock.find(i => i.id === stockId);
    if (item) {
        document.getElementById('montantTotal').value = item.prix;
    }
};

// Ventes
document.getElementById('venteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const stockId = document.getElementById('selectStockVente').value;
    const montant = Number(document.getElementById('montantTotal').value);
    const client = document.getElementById('nomClient').value;
    const tel = document.getElementById('telClientVente').value;

    try {
        let nomArticle = "Produit / Prestation";
        if (stockId) {
            const st = localStock.find(i => i.id === stockId);
            if (st && st.qte > 0) {
                nomArticle = st.nom;
                await setDoc(doc(db, "stock", stockId), { qte: st.qte - 1 }, { merge: true });

                await addDoc(collection(db, "mouvements_stock"), {
                    texte: "➖ Vente de 1 unité de " + st.nom + " (Client: " + client + ")",
                    date: new Date().toLocaleString('fr-FR'),
                    createdAt: serverTimestamp()
                });
            }
        }

        await addDoc(collection(db, "ventes"), {
            pole: "gb",
            article: nomArticle,
            canalVente: document.getElementById('canalVente').value,
            nomClient: client,
            telClient: tel,
            montantTotal: montant,
            employe: currentUser.nom,
            dateString: new Date().toISOString().split('T')[0],
            dateCreation: serverTimestamp()
        });

        alert("Vente enregistrée avec succès !");
        e.target.reset();
        chargerVentes();
        chargerStock();
    } catch (err) { alert("Erreur d'enregistrement."); }
});

// Dépenses
document.getElementById('depenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(currentUser.role !== 'admin') return;

    const pole = document.getElementById('depensePole').value;
    const categorie = document.getElementById('depenseCategorie').value;
    const motif = document.getElementById('depenseMotif').value.trim();
    const montant = Number(document.getElementById('depenseMontant').value);

    try {
        await addDoc(collection(db, "depenses"), {
            pole: pole,
            categorie: categorie,
            motif: motif,
            montant: montant,
            agent: currentUser.nom,
            dateString: new Date().toISOString().split('T')[0],
            dateCreation: serverTimestamp()
        });

        alert("Dépense enregistrée !");
        e.target.reset();
        chargerDepenses();
        chargerVentes();
    } catch (err) { alert("Erreur lors de l'enregistrement de la dépense."); }
});

async function chargerDepenses() {
    if(currentUser.role !== 'admin') return;
    try {
        const snap = await getDocs(query(collection(db, "depenses"), orderBy("dateCreation", "desc")));
        localDepenses = [];
        let html = "";
        snap.forEach(d => {
            const dep = { id: d.id, ...d.data() };
            localDepenses.push(dep);

            html += `
                <div class="depense-item">
                    <div>
                        <strong>${dep.motif}</strong> (${dep.pole === 'gb' ? '🛍️ GB' : dep.pole === 'gh' ? '🌿 GH' : '🏢 Général'})<br>
                        <small style="color:#64748b;">Catégorie : ${dep.categorie} | Par : ${dep.agent} | Date : ${dep.dateString}</small>
                    </div>
                    <div style="text-align:right;">
                        <strong style="color:#dc2626;">-${dep.montant.toLocaleString()} F</strong>
                        <br><button class="btn-action" style="background:#ef4444; font-size:10px; padding:2px 6px;" onclick="supprimerDepense('${dep.id}')">Supprimer</button>
                    </div>
                </div>
            `;
        });

        document.getElementById('depensesListContainer').innerHTML = html || "<p style='text-align:center; color:#64748b;'>Aucune dépense enregistrée.</p>";
        calculerRapportFinancier();
    } catch (err) {}
}

window.supprimerDepense = async (id) => {
    if(currentUser.role !== 'admin') return;
    if (confirm("Voulez-vous supprimer cette dépense ?")) {
        await deleteDoc(doc(db, "depenses", id));
        chargerDepenses();
        chargerVentes();
    }
};

async function chargerVentes() {
    try {
        const snap = await getDocs(query(collection(db, "ventes"), orderBy("dateCreation", "desc")));
        localVentes = [];
        snap.forEach(d => localVentes.push({ id: d.id, ...d.data() }));

        if(currentUser.role === 'admin') calculerRapportFinancier();
        afficherVentes();
    } catch (err) {}
}

function calculerRapportFinancier() {
    if(currentUser.role !== 'admin') return;
    let totalGb = 0, totalGh = 0;
    let totalBoutique = 0, totalWhatsapp = 0;
    let totalDepenses = 0;
    const now = new Date();

    localVentes.forEach(v => {
        const montant = Number(v.montantTotal) || 0;
        const pole = v.pole || (v.nomClient && v.nomClient.includes("Glory Herbal") ? "gh" : "gb");
        const canal = v.canalVente || "boutique";
        
        let vDate = v.dateString ? new Date(v.dateString) : new Date();

        let include = false;
        if (currentPeriod === 'jour') {
            include = v.dateString === now.toISOString().split('T')[0];
        } else if (currentPeriod === 'semaine') {
            const diffTime = Math.abs(now - vDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            include = diffDays <= 7;
        } else if (currentPeriod === 'mois') {
            include = vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
        }

        if (include) {
            if (pole === "gb") totalGb += montant;
            else totalGh += montant;

            if (canal === "whatsapp") totalWhatsapp += montant;
            else totalBoutique += montant;
        }
    });

    localDepenses.forEach(d => {
        const montant = Number(d.montant) || 0;
        let dDate = d.dateString ? new Date(d.dateString) : new Date();

        let include = false;
        if (currentPeriod === 'jour') {
            include = d.dateString === now.toISOString().split('T')[0];
        } else if (currentPeriod === 'semaine') {
            const diffTime = Math.abs(now - dDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            include = diffDays <= 7;
        } else if (currentPeriod === 'mois') {
            include = dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
        }

        if (include) totalDepenses += montant;
    });

    const totalRecettes = totalGb + totalGh;
    const beneficeNet = totalRecettes - totalDepenses;

    document.getElementById('totalGBCasual').textContent = totalGb.toLocaleString() + " F";
    document.getElementById('totalGloryHerbal').textContent = totalGh.toLocaleString() + " F";
    document.getElementById('totalGeneral').textContent = totalRecettes.toLocaleString() + " F";

    document.getElementById('totalCanalBoutique').textContent = totalBoutique.toLocaleString() + " F";
    document.getElementById('totalCanalWhatsapp').textContent = totalWhatsapp.toLocaleString() + " F";

    document.getElementById('totalDepensesDisplay').textContent = totalDepenses.toLocaleString() + " F";
    
    const benefDisplay = document.getElementById('totalBeneficeNetDisplay');
    benefDisplay.textContent = beneficeNet.toLocaleString() + " F";
    benefDisplay.style.color = beneficeNet >= 0 ? "#166534" : "#dc2626";
}

function afficherVentes() {
    const queryText = document.getElementById('searchVente').value.toLowerCase();
    const filtrePole = document.getElementById('filtrePole').value;
    const filtreDate = docum

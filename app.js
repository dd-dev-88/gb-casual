
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
let html5QrCodeScanner = null;

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

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('userCode').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.style.display = 'none';

    const currentAdminCode = await getAdminCodeFromDB();
    if (code === currentAdminCode) {
        currentUser = { nom: "Administrateur", role: "admin" };
        lancerApplication();
        if (currentUser && currentUser.role === 'admin') {
            const btnOuvriers = document.getElementById('btnTabOuvriers');
            if (btnOuvriers) btnOuvriers.style.display = 'inline-block';
        } else {
            const btnOuvriers = document.getElementById('btnTabOuvriers');
            if (btnOuvriers) btnOuvriers.style.display = 'none';
        }
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
            const btnOuvriers = document.getElementById('btnTabOuvriers');
            if (btnOuvriers) btnOuvriers.style.display = 'none';
        } else {
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        errorMsg.style.display = 'block';
    }
});

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

window.lancerScannerVente = () => {
    const readerDiv = document.getElementById('readerVente');
    if (readerDiv.style.display === 'none') {
        readerDiv.style.display = 'block';
        const html5QrCode = new Html5Qrcode("readerVente");
        html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            (decodedText, decodedResult) => {
                const matchedItem = localStock.find(i => i.nom.toLowerCase() === decodedText.toLowerCase() || i.id === decodedText);
                if (matchedItem) {
                    document.getElementById('selectStockVente').value = matchedItem.id;
                    remplirPrixStock();
                    alert("✅ Article scanné et sélectionné : " + matchedItem.nom);
                } else {
                    alert("⚠️ Code scanné : " + decodedText + " (Aucun article correspondant exact dans le stock)");
                }
                html5QrCode.stop().then(() => { readerDiv.style.display = 'none'; }).catch(err => {});
            },
            (errorMessage) => {}
        ).catch(err => {
            alert("Erreur d'accès à la caméra : " + err);
            readerDiv.style.display = 'none';
        });
    } else {
        readerDiv.style.display = 'none';
    }
};

window.afficherQRCodeArticle = function(nomArticle, prixArticle) {
    let modal = document.getElementById('qrCodeModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'qrCodeModal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; z-index:9999;';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background:white; padding:25px; border-radius:14px; text-align:center; max-width:320px; width:90%; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
            <h3 style="margin-top:0; color:#1e293b; font-size:18px;">${nomArticle}</h3>
            <p style="color:#2563eb; font-weight:bold; font-size:16px; margin: 8px 0 15px 0;">${prixArticle} FCFA</p>
            <div id="modalQrContainer" style="display:flex; justify-content:center; margin:15px 0;"></div>
            <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
                <button onclick="window.print()" style="background:#2563eb; color:white; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-weight:bold;">🖨️ Imprimer</button>
                <button onclick="document.getElementById('qrCodeModal').style.display='none'" style="background:#64748b; color:white; border:none; padding:10px 18px; border-radius:8px; cursor:pointer;">Fermer</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    new QRCode(document.getElementById('modalQrContainer'), {
        text: nomArticle,
        width: 160,
        height: 160,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
};

document.getElementById('stockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(currentUser.role !== 'admin') return;

    const editId = document.getElementById('editingStockId').value;
    const nomP = document.getElementById('stockNom').value.trim();
    const poleP = document.getElementById('stockPole').value;
    const prixP = Number(document.getElementById('stockPrix').value);
    const qteP = Number(document.getElementById('stockQte').value);
    const imageInput = document.getElementById('stockImageInput');

    let imageBase64 = "";
    if (imageInput.files && imageInput.files[0]) {
        imageBase64 = await convertirImageEnBase64(imageInput.files[0]);
    }

    try {
        if (editId) {
            const existingItem = localStock.find(i => i.id === editId);
            const stockDataToUpdate = {
                pole: poleP,
                nom: nomP,
                prix: prixP,
                qte: qteP,
                image: imageBase64 || (existingItem ? existingItem.image || "" : "")
            };

            await setDoc(doc(db, "stock", editId), stockDataToUpdate, { merge: true });

            await addDoc(collection(db, "mouvements_stock"), {
                texte: "✏️ Modification de l'article " + nomP + " (Nouveau prix: " + prixP + " F, Qte: " + qteP + ")",
                date: new Date().toLocaleString('fr-FR'),
                createdAt: serverTimestamp()
            });

            alert("Article mis à jour avec succès !");
        } else {
            await addDoc(collection(db, "stock"), {
                pole: poleP,
                nom: nomP,
                prix: prixP,
                qte: qteP,
                image: imageBase64
            });

            await addDoc(collection(db, "mouvements_stock"), {
                texte: "➕ Ajout de " + qteP + " unités de " + nomP,
                date: new Date().toLocaleString('fr-FR'),
                createdAt: serverTimestamp()
            });

            alert("Produit ajouté au stock !");
        }

        annulerEditStock();
        chargerStock();
        chargerMouvementsStock();
    } catch (err) { alert("Erreur : " + err.message); }
});

window.editerStock = (id) => {
    const item = localStock.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editingStockId').value = item.id;
    document.getElementById('stockPole').value = item.pole || 'gb';
    document.getElementById('stockNom').value = item.nom || '';
    document.getElementById('stockPrix').value = item.prix || '';
    document.getElementById('stockQte').value = item.qte || 0;

    document.getElementById('btnSubmitStock').textContent = "Enregistrer la modification";
    document.getElementById('btnSubmitStock').className = "btn-update";
    document.getElementById('btnCancelEditStock').style.display = "block";
    document.getElementById('txtImageNote').style.display = "block";

    window.scrollTo({ top: document.getElementById('adminStockSection').offsetTop, behavior: 'smooth' });
};

window.annulerEditStock = () => {
    document.getElementById('editingStockId').value = '';
    document.getElementById('stockForm').reset();
    document.getElementById('btnSubmitStock').textContent = "Ajouter au Catalogue";
    document.getElementById('btnSubmitStock').className = "btn-valider stock-btn";
    document.getElementById('btnCancelEditStock').style.display = "none";
    document.getElementById('txtImageNote').style.display = "none";
};

window.supprimerStock = async (id, nom) => {
    if(currentUser.role !== 'admin') return;
    if (confirm("Voulez-vous vraiment SUPPRIMER définitivement l'article '" + nom + "' du catalogue ?")) {
        try {
            await deleteDoc(doc(db, "stock", id));

            await addDoc(collection(db, "mouvements_stock"), {
                texte: "🗑️ Suppression de l'article " + nom + " du catalogue",
                date: new Date().toLocaleString('fr-FR'),
                createdAt: serverTimestamp()
            });

            alert("Article supprimé du stock.");
            chargerStock();
            chargerMouvementsStock();
        } catch (err) {
            alert("Erreur lors de la suppression.");
        }
    }
};

function convertirImageEnBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

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
            
            const imgTag = st.image ? `<img src="${st.image}" class="stock-img-thumb" alt="produit">` : `<div style="width:45px; height:45px; background:#e2e8f0; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:18px; margin-right:10px;">📦</div>`;

            const adminActions = currentUser.role === 'admin' ? `
                <div style="margin-top:6px;">
                    <button type="button" class="btn-action" style="font-size:10px; padding:4px 8px; background:#f59e0b; color:white; border:none; border-radius:4px; cursor:pointer;" onclick="editerStock('${st.id}')">Modifier / Photo</button>
                    <button type="button" class="btn-action" style="background:#ef4444; font-size:10px; padding:4px 8px; color:white; border:none; border-radius:4px; cursor:pointer; margin-left:4px;" onclick="supprimerStock('${st.id}')">Supprimer</button>
                    <button type="button" class="btn-action" style="background:#8b5cf6; font-size:10px; padding:4px 8px; color:white; border:none; border-radius:4px; cursor:pointer; margin-left:4px;" onclick="afficherQRCodeArticle('${st.nom}', '${st.prix}')">📱 QR Code</button>
                </div>
            ` : '';

            html += `<div class="${itemClass}"><div style="display:flex; align-items:center;">${imgTag}<div><strong>${st.nom}</strong> (${st.pole === 'gb' ? '🛍️ GB Casual' : '🌿 Glory Herbal'})<br><small style="color:#64748b;">Prix : ${st.prix.toLocaleString()} F</small>${adminActions}</div></div><div><span class="${badgeClass}">${badgeText}</span></div></div>`;

            selectOptions += `<option value="${st.id}">${st.nom} - ${st.prix} FCFA (Stock:${st.qte})</option>`;
        });

        if (document.getElementById('cartProductSelect')) {
            document.getElementById('cartProductSelect').innerHTML = selectOptions;
        }
        
        const banner = document.getElementById('stockDashboardBanner');
        const listContainer = document.getElementById('stockDashboardListContainer');

        if (alertItems.length > 0) {
            let dashHtml = "";
            alertItems.forEach(item => {
                const btnReappro = currentUser.role === 'admin' 
                    ? `<button type="button" class="btn-reappro" onclick="reapprovisionnerRapide('${item.id}', '${item.nom}',${item.qte})">➕ Réapprovisionner (+5)</button>` 
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
        const qteInput = document.getElementById('quantiteVente');
        let qte = qteInput ? parseInt(qteInput.value) : 1;
        if (isNaN(qte) || qte < 1) qte = 1;

        document.getElementById('montantTotal').value = item.prix * qte;
    }
};

document.getElementById('quantiteVente')?.addEventListener('input', window.remplirPrixStock);
document.getElementById('selectStockVente')?.addEventListener('change', window.remplirPrixStock);

document.getElementById('venteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const stockId = document.getElementById('selectStockVente').value;
    const qteInput = document.getElementById('quantiteVente');
    
    let quantite = qteInput ? parseInt(qteInput.value) : 1;
    if (isNaN(quantite) || quantite < 1) quantite = 1;

    const montantTotal = Number(document.getElementById('montantTotal').value) || 0;

    const clientInput = document.getElementById('nomClient').value.trim();
    const telInput = document.getElementById('telClientVente').value.trim();
    const client = clientInput !== '' ? clientInput : 'Client de passage';
    const tel = telInput !== '' ? telInput : 'N/A';

    try {
        let nomArticle = "Produit / Prestation";
        
        if (stockId) {
            const st = localStock.find(i => i.id === stockId);
            
            if (st) {
                if (st.qte < quantite) {
                    alert(`Stock insuffisant ! Seules ${st.qte} unité(s) sont disponibles.`);
                    return;
                }

                nomArticle = st.nom;

                await setDoc(doc(db, "stock", stockId), { 
                    qte: st.qte - quantite 
                }, { merge: true });

                await addDoc(collection(db, "mouvements_stock"), {
                    texte: `📦 Vente de ${quantite} unité(s) de ${st.nom} (Client:${client})`,
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
            quantite: quantite,
            montantTotal: montantTotal,
            employe: currentUser.nom,
            dateString: new Date().toISOString().split('T')[0],
            dateCreation: serverTimestamp()
        });

        alert("Vente enregistrée avec succès !");
        
        document.getElementById('venteForm').reset();
        if (qteInput) qteInput.value = 1;
        document.getElementById('montantTotal').value = '';

        if (typeof chargerVentes === 'function') chargerVentes();
        if (typeof chargerStock === 'function') chargerStock();

    } catch (err) {
        alert("Erreur lors de l'enregistrement de la vente : " + err.message);
    }
});

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
                        <small style="color:#64748b;">Catégorie : ${dep.categorie} | Par : ${dep.agent} \vert{} Date :${dep.dateString}</small>
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
    const filtreDate = document.getElementById('filtreDateSpecifique').value.trim();
    const dateAujourdhui = new Date().toISOString().split('T')[0];

    let html = "";
    localVentes.forEach(v => {
        const pole = v.pole || (v.nomClient && v.nomClient.includes("Glory Herbal") ? "gh" : "gb");
        const canal = v.canalVente === 'whatsapp' ? '📲 WhatsApp' : '🏪 Boutique';
        const montant = Number(v.montantTotal) || 0;

        if (currentUser.role === 'employe') {
            if (v.dateString !== dateAujourdhui || v.employe !== currentUser.nom) return;
        } else {
            if (filtrePole !== "tous" && filtrePole !== pole) return;
            if (filtreDate && v.dateString !== filtreDate) return;
            if (queryText && !v.nomClient.toLowerCase().includes(queryText) && !(v.employe && v.employe.toLowerCase().includes(queryText))) return;
        }

        html += `
            <div class="sale-item ${pole}">
                <div>
                    <strong>${v.nomClient}</strong> (${v.telClient || 'N/A'})<br>
                    <small style="color:#64748b;">${pole === 'gb' ? '🛍️ GB Casual' : '🌿 Glory Herbal'} \vert{} ${canal} | Par : ${v.employe \vert{}\vert{} 'Admin'} \vert{} Date :${v.dateString || 'N/A'}</small>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; color:${pole === 'gb' ? '#be185d' : '#15803d'}">${montant.toLocaleString()} F</div>
                    <button class="btn-wa" style="padding:4px 8px; font-size:10px; margin-top:4px;" onclick="ouvrirModalRecu('${v.id}')">📄 Reçu / Facture</button>
                </div>
            </div>
        `;
    });

    document.getElementById('salesContainer').innerHTML = html || "<p style='text-align:center; color:#64748b;'>Aucune recette trouvée pour cette sélection.</p>";
}

window.ouvrirModalRecu = (id) => {
    const v = localVentes.find(i => i.id === id);
    if (!v) return;

    const nomEtab = 'GB CASUAL';
    document.getElementById('modalTitleText').textContent = "🧾 Reçu de Paiement";
    
    currentReceiptText = `=================================\n          ${nomEtab}\n   Reçu de Paiement / Facture\n=================================\n\nClient(e) : ${v.nomClient}\nTéléphone : ${v.telClient || 'N/A'}\nArticle/Soin : ${v.article \vert{}\vert{} 'Prestation'}\nMontant Payé : ${v.montantTotal.toLocaleString()} FCFA\nAgent : ${v.employe \vert{}\vert{} 'Admin'}\nDate :${v.dateString || new Date().toLocaleDateString('fr-FR')}\n\n=================================\nMerci de votre confiance ! 🛍️🌿`;

    document.getElementById('receiptTextContent').textContent = currentReceiptText;
    document.getElementById('receiptModal').classList.add('active');
};

window.ouvrirModalSuiviPatient = (id) => {
    const p = localPatients.find(i => i.id === id);
    if (!p) return;

    document.getElementById('modalTitleText').textContent = "🩺 Carnet de Suivi Patient";

    let texteSuivi = `=================================\n       CLINIQUE GLORY HERBAL\n    Fiche de Suivi du Patient\n=================================\n\nPatient(e) : ${p.nom} (${p.sexe}, ${p.age} ans)\nTéléphone : ${p.tel}\nDiagnostic : ${p.problemes \vert{}\vert{} 'Non spécifié'}\nProchain RDV : ${p.prochainRdv || 'Non programmé'}\n\n---------------------------------\nHISTORIQUE DES CONSULTATIONS :\n---------------------------------\n`;

    if (p.historiqueSuivi && p.historiqueSuivi.length > 0) {
        p.historiqueSuivi.forEach((s, idx) => {
            texteSuivi += `\n[Visite N°${idx + 1} -${s.date}]\n- Notes : ${s.notes}\n- Traitement :${s.traitement || 'Non spécifié'}\n`;
        });
    } else {
        texteSuivi += `\nAucune consultation ultérieure enregistrée.\n`;
    }

    texteSuivi += `\n=================================\nGlory Herbal - Santé par les plantes🌿`;

    currentReceiptText = texteSuivi;
    document.getElementById('receiptTextContent').textContent = currentReceiptText;
    document.getElementById('receiptModal').classList.add('active');
};

window.fermerModalRecu = () => {
    document.getElementById('receiptModal').classList.remove('active');
};

window.copierTexteRecu = () => {
    navigator.clipboard.writeText(currentReceiptText).then(() => {
        alert("Texte copié ! Tu peux le coller directement sur WhatsApp.");
    }).catch(() => {
        alert("Copié dans le presse-papier !");
    });
};

window.imprimerModalRecu = () => {
    const printWin = window.open('', '', 'width=600,height=600');
    printWin.document.write('<pre style="font-family:monospace; font-size:13px; padding:20px;">' + currentReceiptText + '</pre>');
    printWin.document.close();
    printWin.focus();
    printWin.print();
};

document.getElementById('patientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editingPatientId').value;
    const rdvValue = document.getElementById('pProchainRdv').value.trim();

    const dataPatient = {
        nom: document.getElementById('pNom').value,
        sexe: document.getElementById('pSexe').value,
        age: document.getElementById('pAge').value,
        tel: document.getElementById('pTel').value,
        region: document.getElementById('pRegion').value,
        refere: document.getElementById('pRefere').value,
        date: document.getElementById('pDate').value,
        adresse: document.getElementById('pAdresse').value,
        ethnie: document.getElementById('pEthnie').value,
        antecedentsMed: document.getElementById('pAntecedentsMed').value,
        antecedentsFam: document.getElementById('pAntecedentsFam').value,
        profession: document.getElementById('pProfession').value,
        antSociaux: document.getElementById('pAntSociaux').value,
        motif: document.getElementById('pMotif').value,
        plaintesPrinc: document.getElementById('pPlaintesPrinc').value,
        plaintesSec: document.getElementById('pPlaintesSec').value,
        examen: document.getElementById('pExamen').value,
        problemes: document.getElementById('pProblemes').value,
        prochainRdv: rdvValue,
        montant: Number(document.getElementById('pMontant').value) || 0
    };

    try {
        if (editId) {
            await setDoc(doc(db, "fiches_patients", editId), dataPatient, { merge: true });
            alert("Fiche patient mise à jour !");
        } else {
            dataPatient.agent = currentUser.nom;
            dataPatient.createdAt = serverTimestamp();
            dataPatient.historiqueSuivi = [];
            
            await addDoc(collection(db, "fiches_patients"), dataPatient);

            if(dataPatient.montant > 0) {
                await addDoc(collection(db, "ventes"), {
                    pole: "gh",
                    article: "Première Consultation / Soin",
                    canalVente: "boutique",
                    nomClient: dataPatient.nom + " (Glory Herbal)",
                    telClient: dataPatient.tel,
                    montantTotal: dataPatient.montant,
                    modePaiement: "especes",
                    employe: currentUser.nom,
                    dateString: dataPatient.date,
                    dateCreation: serverTimestamp()
                });
            }
            alert("Fiche patient créée !");
        }

        annulerModification();
        await chargerPatients();
        switchSubTab('list');
    } catch (err) {
        alert("Erreur : " + err.message);
    }
});

async function chargerPatients() {
    try {
        const snap = await getDocs(query(collection(db, "fiches_patients"), orderBy("createdAt", "desc")));
        localPatients = [];
        snap.forEach(d => localPatients.push({ id: d.id, ...d.data() }));
        afficherPatients(localPatients);
        verifierNotificationsRdv(localPatients);
    } catch (err) {
        document.getElementById('patientResultsContainer').innerHTML = "<p style='text-align:center;'>Aucun dossier trouvé.</p>";
    }
}

function verifierNotificationsRdv(liste) {
    const today = new Date().toISOString().split('T')[0];
    const rdvAujourdhui = liste.filter(p => p.prochainRdv && p.prochainRdv.includes(today));

    const banner = document.getElementById('rdvNotificationBanner');
    const container = document.getElementById('rdvListTodayContainer');

    if (rdvAujourdhui.length > 0) {
        let htmlNotify = "";
        rdvAujourdhui.forEach(p => {
            htmlNotify += `
                <div class="rdv-item-notify">
                    <div>
                        <strong>👤 ${p.nom}</strong> (${p.tel})<br>
                        <small style="color:#b45309;">RDV : ${p.prochainRdv}</small>
                    </div>
                </div>
            `;
        });
        container.innerHTML = htmlNotify;
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
}

function afficherPatients(liste) {
    let html = "";
    if (liste.length === 0) {
        document.getElementById('patientResultsContainer').innerHTML = "<p style='text-align:center; color:#64748b;'>Aucun dossier patient.</p>";
        return;
    }

    liste.forEach(p => {
        let suiviListHtml = "";
        if (p.historiqueSuivi && p.historiqueSuivi.length > 0) {
            p.historiqueSuivi.forEach(s => {
                suiviListHtml += '<div class="followup-item"><strong>📅 ' + s.date + '</strong> - ' + s.notes + '<br><small style="color:#15803d;">Traitement : ' + (s.traitement || 'Non spécifié') + ' | Payé : ' + (s.montant ? s.montant + ' F' : '0 F') + '</small></div>';
            });
        } else {
            suiviListHtml = "<p style='font-size:11px; color:#64748b; font-style:italic;'>Aucune visite de suivi enregistrée.</p>";
        }

        const displayRdv = (p.prochainRdv && p.prochainRdv.trim() !== '') 
            ? '📅 Prochain RDV : <strong style="color:#15803d; font-size:13px;">' + p.prochainRdv + '</strong>' 
            : '📅 <span style="color:#94a3b8;">Aucun RDV programmé</span>';

        html += '<div class="patient-card-result"><div><div style="font-weight:bold; font-size:14px;">' + p.nom + ' (' + p.sexe + ', ' + p.age + ' ans)</div><div style="font-size:12px; color:#64748b;">📞 ' + p.tel + ' | 📍 ' + (p.region || 'N/A') + ' | Fiche du: ' + p.date + '</div></div><div style="font-size:12px; color:#334155; margin-top:4px;"><strong>Motif :</strong> ' + p.motif + '<br><strong>Diagnostic :</strong> ' + (p.problemes || 'Non renseigné') + '<br>' + displayRdv + '</div><div style="margin-top:8px;"><button class="btn-action" onclick="toggleDetails(\'' + p.id + '\')">📋 Fiche Complète</button><button class="btn-edit-patient" onclick="editerPatient(\'' + p.id + '\')">✏️ Modifier / RDV</button><button class="btn-wa" onclick="ouvrirModalSuiviPatient(\'' + p.id + '\')">📲 Partager Carnet (WA)</button></div><div class="followup-section"><h4 style="font-size:12px; color:#15803d; margin-bottom:6px;">🩺 Carnet de Suivi :</h4><div id="suiviList-' + p.id + '">' + suiviListHtml + '</div><div style="margin-top:8px; border-top:1px solid #cbd5e1; padding-top:8px;"><label style="font-size:11px;">Ajouter une consultation de contrôle :</label><input type="text" id="suiviNote-' + p.id + '" placeholder="Observations..." style="font-size:11px; padding:6px; margin-bottom:4px;"><input type="text" id="suiviTraitement-' + p.id + '" placeholder="Traitement prescrit..." style="font-size:11px; padding:6px; margin-bottom:4px;"><div style="display:flex; gap:5px;"><input type="number" id="suiviMontant-' + p.id + '" placeholder="Montant (F)" style="font-size:11px; padding:6px; flex:1;"><button type="button" class="btn-action" style="margin:0; width:auto;" onclick="ajouterVisiteSuivi(\'' + p.id + '\')">+ Enregistrer</button></div></div></div><div id="details-' + p.id + '" style="display:none; margin-top:10px; font-size:11px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;"><p><strong>Adresse :</strong> ' + (p.adresse || 'N/A') + '</p><p><strong>Référé par :</strong> ' + (p.refere || 'N/A') + '</p><p><strong>Antécédents :</strong> ' + (p.antecedentsMed || 'Aucun') + '</p></div></div>';
    });
    document.getElementById('patientResultsContainer').innerHTML = html;
}

window.ajouterVisiteSuivi = async (patientId) => {
    const note = document.getElementById('suiviNote-' + patientId).value.trim();
    const traitement = document.getElementById('suiviTraitement-' + patientId).value.trim();
    const montant = Number(document.getElementById('suiviMontant-' + patientId).value) || 0;

    if(!note) return alert("Veuillez saisir une observation.");

    const dateJour = new Date().toLocaleDateString('fr-FR');
    const nouvelleVisite = { date: dateJour, notes: note, traitement: traitement, montant: montant };

    try {
        await setDoc(doc(db, "fiches_patients", patientId), {
            historiqueSuivi: arrayUnion(nouvelleVisite)
        }, { merge: true });

        if(montant > 0) {
            const p = localPatients.find(i => i.id === patientId);
            await addDoc(collection(db, "ventes"), {
                pole: "gh",
                article: "Consultation de contrôle",
                canalVente: "boutique",
                nomClient: (p ? p.nom : "Patient") + " (Suivi)",
                telClient: p ? p.tel : '',
                montantTotal: montant,
                employe: currentUser.nom,
                dateString: new Date().toISOString().split('T')[0],
                dateCreation: serverTimestamp()
            });
        }

        alert("Visite enregistrée !");
        chargerPatients();
    } catch (err) { alert("Erreur."); }
};

window.toggleDetails = (id) => {
    const el = document.getElementById('details-' + id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.editerPatient = (id) => {
    const p = localPatients.find(item => item.id === id);
    if (!p) return;

    document.getElementById('editingPatientId').value = p.id;
    document.getElementById('pNom').value = p.nom || '';
    document.getElementById('pSexe').value = p.sexe || 'M';
    document.getElementById('pAge').value = p.age || '';
    document.getElementById('pTel').value = p.tel || '';
    document.getElementById('pRegion').value = p.region || '';
    document.getElementById('pRefere').value = p.refere || '';
    document.getElementById('pDate').value = p.date || new Date().toISOString().split('T')[0];
    document.getElementById('pAdresse').value = p.adresse || '';
    document.getElementById('pEthnie').value = p.ethnie || '';
    document.getElementById('pAntecedentsMed').value = p.antecedentsMed || '';
    document.getElementById('pAntecedentsFam').value = p.antecedentsFam || '';
    document.getElementById('pProfession').value = p.profession || '';
    document.getElementById('pAntSociaux').value = p.antSociaux || '';
    document.getElementById('pMotif').value = p.motif || '';
    document.getElementById('pPlaintesPrinc').value = p.plaintesPrinc || '';
    document.getElementById('pPlaintesSec').value = p.plaintesSec || '';
    document.getElementById('pExamen').value = p.examen || '';
    document.getElementById('pProblemes').value = p.problemes || '';
    document.getElementById('pProchainRdv').value = p.prochainRdv || '';
    document.getElementById('pMontant').value = p.montant || '';

    document.getElementById('formTitle').textContent = "✏️ Modification pour " + p.nom;
    document.getElementById('btnSubmitPatient').textContent = "Enregistrer les modifications";
    document.getElementById('btnSubmitPatient').className = "btn-update";
    document.getElementById('btnCancelEdit').style.display = "block";

    switchSubTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.annulerModification = () => {
    document.getElementById('editingPatientId').value = '';
    document.getElementById('patientForm').reset();
    document.getElementById('pDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('pProchainRdv').value = '';
    document.getElementById('formTitle').textContent = "Saisie de la Fiche du Patient (Glory Herbal)";
    document.getElementById('btnSubmitPatient').textContent = "Enregistrer la Fiche Patient";
    document.getElementById('btnSubmitPatient').className = "btn-valider";
    document.getElementById('btnCancelEdit').style.display = "none";
};

window.filtrerPatients = () => {
    const q = document.getElementById('searchPatient').value.toLowerCase();
    const filtres = localPatients.filter(p => p.nom.toLowerCase().includes(q) || p.tel.includes(q));
    afficherPatients(filtres);
};

document.getElementById('employeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(currentUser.role !== 'admin') return;

    const editId = document.getElementById('editingEmpId').value;
    const empData = {
        nom: document.getElementById('empNom').value.trim(),
        age: document.getElementById('empAge').value.trim(),
        situation: document.getElementById('empSituation').value,
        tel: document.getElementById('empTel').value.trim(),
        lieu: document.getElementById('empLieu').value.trim(),
        code: document.getElementById('empCode').value.trim()
    };

    try {
        if (editId) {
            await setDoc(doc(db, "employes", editId), empData, { merge: true });
            alert("Employé mis à jour !");
        } else {
            empData.createdAt = serverTimestamp();
            await addDoc(collection(db, "employes"), empData);
            alert("Employé enregistré !");
        }
        
        annulerEditEmploye();
        chargerEmployes();
    } catch (err) { alert("Erreur."); }
});

async function chargerEmployes() {
    if(currentUser.role !== 'admin') return;
    try {
        const snap = await getDocs(collection(db, "employes"));
        localEmployes = [];
        let html = "";
        snap.forEach(d => {
            const emp = { id: d.id, ...d.data() };
            localEmployes.push(emp);

            html += `
                <div class="sale-item emp">
                    <div>
                        <strong style="color:#7e22ce; font-size:14px;">${emp.nom}</strong> (${emp.age ? emp.age + ' ans' : 'N/A'}, ${emp.situation || 'Célibataire'})<br>
                        <small style="color:#475569;">📞 <strong>${emp.tel \vert{}\vert{} 'N/A'}</strong> \vert{} 📍 ${emp.lieu || 'N/A'}</small><br>
                        <small style="color:#64748b;">🔑 Code : <strong>${emp.code}</strong></small>
                    </div>
                    <div style="text-align:right;">
                        <button class="btn-edit-patient" style="font-size:10px; padding:4px 8px; margin:0 0 4px 0;" onclick="editerEmploye('${emp.id}')">✏️ Modifier</button><br>
                        <button class="btn-action" style="background:#ef4444; font-size:10px; padding:4px 8px; margin:0;" onclick="supprimerEmploye('${emp.id}')">Supprimer</button>
                    </div>
                </div>
            `;
        });
        document.getElementById('employesContainer').innerHTML = html || "<p style='text-align:center; color:#64748b;'>Aucun employé enregistré.</p>";
    } catch (err) {}
}

window.editerEmploye = (id) => {
    const emp = localEmployes.find(e => e.id === id);
    if (!emp) return;

    document.getElementById('editingEmpId').value = emp.id;
    document.getElementById('empNom').value = emp.nom || '';
    document.getElementById('empAge').value = emp.age || '';
    document.getElementById('empSituation').value = emp.situation || 'Célibataire';
    document.getElementById('empTel').value = emp.tel || '';
    document.getElementById('empLieu').value = emp.lieu || '';
    document.getElementById('empCode').value = emp.code || '';

    document.getElementById('employeFormTitle').textContent = "✏️ Modification de " + emp.nom;
    document.getElementById('btnSubmitEmp').textContent = "Mettre à jour";
    document.getElementById('btnSubmitEmp').className = "btn-update";
    document.getElementById('btnCancelEditEmp').style.display = "block";

    window.scrollTo({ top: document.getElementById('paneAdmin').offsetTop, behavior: 'smooth' });
};

window.annulerEditEmploye = () => {
    document.getElementById('editingEmpId').value = '';
    document.getElementById('employeForm').reset();
    document.getElementById('employeFormTitle').textContent = "👔 Fiche & Inscription de l'Employé(e)";
    document.getElementById('btnSubmitEmp').textContent = "Créer la Fiche Employé";
    document.getElementById('btnSubmitEmp').className = "btn-valider";
    document.getElementById('btnSubmitEmp').style.backgroundColor = "#7e22ce";
    document.getElementById('btnCancelEditEmp').style.display = "none";
};

window.supprimerEmploye = async (id) => {
    if(currentUser.role !== 'admin') return;
    if (confirm("Supprimer cet employé ?")) {
        await deleteDoc(doc(db, "employes", id));
        chargerEmployes();
    }
};

document.getElementById('btnExporterDonnees')?.addEventListener('click', () => {
    if(currentUser.role !== 'admin') return;
    try {
        const sauvegarde = {
            localStorageData: { ...localStorage },
            dateSauvegarde: new Date().toISOString()
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sauvegarde, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "gb_casual_backup_" + new Date().toISOString().split('T')[0] + ".json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        alert("✅ Sauvegarde exportée !");
    } catch (error) { alert("Erreur."); }
});

document.getElementById('inputFichierBackup')?.addEventListener('change', (event) => {
    if(currentUser.role !== 'admin') return;
    const fichier = event.target.files[0];
    if (!fichier) return;

    const lecteur = new FileReader();
    lecteur.onload = function(e) {
        try {
            const donneesImportees = JSON.parse(e.target.result);
            if (confirm("Restaurer cette sauvegarde ?")) {
                if (donneesImportees.localStorageData) {
                    for (const cle in donneesImportees.localStorageData) {
                        localStorage.setItem(cle, donneesImportees.localStorageData[cle]);
                    }
                }
                alert("Restauré avec succès !");
                location.reload();
            }
        } catch (erreur) { alert("Fichier invalide."); }
    };
    lecteur.readAsText(fichier);
});

document.getElementById('resetCloudBtn')?.addEventListener('click', async () => {
    if(currentUser.role !== 'admin') return;
    if (confirm("⚠️ Êtes-vous sûr de vouloir EFFACER TOUTES LES DONNÉES DU CLOUD (ventes, dépenses, patients, stock, employés) ? Cette action est irréversible pour préparer la livraison.")) {
        try {
            const collectionsToClean = ["ventes", "depenses", "fiches_patients", "stock", "employes", "mouvements_stock"];
            
            for (const colName of collectionsToClean) {
                const snap = await getDocs(collection(db, colName));
                for (const d of snap.docs) {
                    await deleteDoc(doc(db, colName, d.id));
                }
            }

            localStorage.clear();
            sessionStorage.clear();
            alert("✅ Base de données Cloud nettoyée avec succès ! L'application est maintenant vierge.");
            location.reload();
        } catch (err) {
            alert("Erreur lors de la réinitialisation cloud : " + err.message);
        }
    }
});

window.ouvrirGestionOuvriers = async () => {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'admin') {
        alert("⛔ Accès refusé : Cette section est strictement réservée à l'administrateur.");
        return;
    }

    const modalId = 'ouvriersModalOverlay';
    let existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:9999; padding:10px; box-sizing:border-box;';

    let optionsEmployes = '<option value="">-- Sélectionner un ouvrier --</option>';
    try {
        const snap = await getDocs(collection(db, "employes"));
        snap.forEach(docSnap => {
            const data = docSnap.data();
            optionsEmployes += `<option value="${docSnap.id}" data-nom="${data.nom || ''}">${data.nom \vert{}\vert{} 'Sans nom'} -${data.poste || 'Ouvrier'}</option>`;
        });
    } catch(err) {
        console.error("Erreur chargement employés :", err);
    }

    overlay.innerHTML = `
        <div style="background:white; border-radius:12px; width:100%; max-width:550px; max-height:90vh; overflow-y:auto; padding:20px; box-shadow:0 5px 20px rgba(0,0,0,0.3); font-family:sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:10px; margin-bottom:15px;">
                <h2 style="margin:0; color:#0284c7; font-size:18px;">

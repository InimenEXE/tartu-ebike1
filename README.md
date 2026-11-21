# Tartu E-Bike 300 🚲⚡

Elektriratta simulaator Tartus. **Sisseehitatud Tartu kaart avaneb mõne sekundiga** (Emajõgi, peateed ja vaatamisväärsused päris kohtadel, linnaosad nende iseloomu järgi). Soovi korral saab laadida ka päris OpenStreetMapi kaardi.
Linnast välja viivad maanteed (Tallinna, Riia, Võru, Narva, Räpina, Viljandi mnt), kus saab sõita **300 km/h**.
Juhtimine käib **käte jälgimise AI-ga** (Google MediaPipe, 21 punkti kummalgi käel). Gaasi, piduri ja rooli AI-d saad ise treenida.

## GitHubis käivitamine (GitHub Pages)

1. Loo GitHubis uus repo, nt `tartu-ebike` (Public).
2. Vajuta **Add file → Upload files** ja lohista sinna **kogu selle kausta sisu** (`index.html`, `style.css`, `js/`, `data/`, `.nojekyll`). Vajuta **Commit changes**.
3. Ava **Settings → Pages**. Vali **Source: Deploy from a branch**, **Branch: main**, kaust **/ (root)** ja vajuta **Save**.
4. Umbes minuti pärast on mäng aadressil `https://SINU-NIMI.github.io/tartu-ebike/`.

Kaamera töötab ainult **https** lehel (GitHub Pages on https), kohalikult avatud failina või `localhost`-is.

## TartuOS

Mäng avaneb **töölauana** (nagu operatsioonisüsteem): äpid **🚲 Sõida**, **🖐 Sõida kaameraga**, **🎓 Õpeta ratast**, **⚙️ Seaded** ja **❔ Abi**, all on tegumiriba kellaga. Aknaid saab lohistada ja suurendada. `Esc` mängus viib tagasi töölauale.

**⚙️ Seaded**: Juhtimine (kaamera eelvaade, käte AI, rooli/piduri/gaasi tundlikkus, surnud tsoon), Graafika (kvaliteet, vaatekaugus, FOV, efektid), Maailm (kaart, autode arv, tippkiirus), Heli, Kuva (minikaart, km/h või mph), AI andmed, Teave.

## 🎓 Õpeta ratast (AR eelvaatega)

1. Klõpsa kaamerapildil **pidurihoova** peale.
2. Klõpsa **käiguvahetaja (gaasi)** peale.
3. Klõpsa oma **näole** (rooli jaoks, võib vahele jätta).
4. Tee järjest neid liigutusi, mis ekraanil kirjas on: pidur lahti/all, gaas lahti/pool/põhjas, pea otse/vasakule/paremale.
5. AI õpib (umbes 10 s) ja **AR eelvaade** näitab nooltega, kus pidur ja gaas on ning kas need on vajutatud (protsendiga).

## 🚲 Lenks ja 👀 vaade

- **Kuhu sa lenksu keerad, sinna ratas sõidab.** Käte AI näeb, et lenksu keerates liigub üks käsi kaamerale lähemale ja teine kaugemale. Rooliks saad valida ka käte kalde või pea kallutuse (Seaded → Juhtimine).
- **Kuhu sa vaatad, sinna pöörab mängu kaamera.** Selleks on näo AI (Google MediaPipe Face Landmarker). Klahv `L` seab otsevaate.

## 🔫 Täpsuslask

1. Ava töölaual **🔫 Täpsuslask** ja võta kätte mängupüss (või tee sõrmedest püss).
2. Klõpsa kaamerapildil püssi peale. Siis jälgib AI seda kätt.
3. Vajuta **🎓 Õpeta püss**: sihi järjest 9 märklauda ja näita, kuidas päästikut tõmbad. AI õpib sihtimise (regressioon) ja päästiku (närvivõrk).
4. **🎯 Täpsusmäng**: 45 sekundit märklaudu, punktid, täpsus, reaktsiooniaeg ja rekord.
5. **🖱 Juhi TartuOS-i püssiga**: sihi nuppu või äpi ikooni ja tõmba päästikut, see toimib nagu klikk.

Ilma käte AI-ta saab täpsusmängu mängida hiirega.

## Käte AI

Vajuta **„🖐 Kaamera + käte AI“**. Esimesel korral laeb mäng käte AI mudeli (~8 MB, edenemisriba näitab aega).
- **Parem käsi**: tõmba pidurihooba → pidur
- **Vasak pöial**: vajuta käiguvahetajat → gaas
- **Rool**: pea kallutus (vaikimisi) või käte/lenksu kalle

Tee kas **„Lihtne kalibreerimine“** (12 s) või salvesta AI treeningus näiteid ja vajuta **„Treeni AI“**.
Käte AI töötab ainult GitHub Pages lingilt (https), mitte topeltklikiga avatud failist.

## Päris OpenStreetMapi kaart (valikuline)

Menüüs saad valida **„🌍 Päris OSM kaart“**. Esimesel korral võtab laadimine 1–3 minutit, seejärel on kaart brauseris olemas.

**Soovitus:** menüüs **„Kaart ja failid“ → „💾 Salvesta kaardifail“** ja laadi saadud `tartu-osm.json` reposse kausta `data/`.
Siis laeb mäng kaardi otse sinu GitHubist (kiire, töötab ka siis, kui OpenStreetMap on aeglane).

## Juhtimine

| Mis | Klaviatuur / pult | Kaamera |
|---|---|---|
| Gaas | `W` / `↑` / pult R2 | käiguvahetaja |
| Pidur | `S` / `↓` / tühik / pult L2 | pidurihoob |
| Rool | `A` `D` / `←` `→` / pult kang | pea kallutamine |
| Teleport (Raekoja plats, Tallinna mnt, Ihaste, Lõunakeskus, Annelinn, Supilinn, Karlova, ERM, maanteed) | `T` | |
| Vaade: sõitja silmad / tagant | `V` | |
| Tagasi Raekoja platsile + aku täis | `R` | |
| Kaamera ja AI seaded | `C` | |
| Minikaardi suum | `M` | |

## AI treenimine (gaas, pidur, rool)

1. Vajuta **„🎥 Kaamera + AI juhtimine“** ja luba kaamera.
2. Joonista pildile kolm kasti: 🔴 **Pidur** pidurihoova peale, 🟢 **Gaas** käiguvahetaja peale, 🟡 **Pea** oma pea ümber.
3. Igal juhtimisel on nupud iga olukorra jaoks:
   - PIDUR: `lahti`, `vajutatud`
   - GAAS: `lahti`, `pool`, `täis`
   - ROOL: `vasak`, `otse`, `parem`
   Kliki nupule, siis on **3 sekundit** aega käed rattale panna, ja **4 sekundit** salvestatakse näiteid.
   Salvesta iga olukorda 2–3 korda, natuke erinevalt (veidi teise nurga või valgusega). Mida rohkem, seda parem.
4. Vajuta **„🧠 Treeni AI“**. Graafik näitab, kui täpne AI on (eesmärk 90%+).
5. Proovi: kasti juures näed AI ennustust protsentides. Kui miski läheb valesti, salvesta sellest olukorrast juurde näiteid ja treeni uuesti.
6. **„⬇ Ekspordi AI“** salvestab mudeli ja näited faili. Kui paned selle reposse nimega `data/ai-model.json`, laeb mäng selle automaatselt igas arvutis.

AI on väike närvivõrk (MLP), mis jookseb täielikult sinu brauseris. Pilte kuhugi ei saadeta.

## Failid

- `index.html`, `style.css`: leht ja välimus
- `js/osm.js`: kaardi laadimine (OpenStreetMap / vahemälu / `data/tartu-osm.json`)
- `js/world.js`: 3D maailm: majad (päris kuju ja kõrgus), teed, jõgi, pargid, puud, poodide sildid
- `js/traffic.js`: autod päris tänavavõrgus
- `js/ai.js`: närvivõrk ja treenimine
- `js/vision.js`: kaamera, kastid, kalibreerimine
- `js/game.js`: mäng, füüsika, minikaart, menüüd
- `js/tartu-map.js`: sisseehitatud Tartu kaart
- `js/hands.js` + `js/mediapipe/`: käte jälgimise AI (Google MediaPipe, Apache 2.0)
- `js/bike.js`: e-ratta ja sõitja 3D mudel
- `js/three.min.js`: Three.js r149 (MIT)

Kaardiandmed © OpenStreetMapi kaastöötajad (ODbL).

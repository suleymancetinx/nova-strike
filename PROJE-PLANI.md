# NOVA STRIKE — Birinci Şahıs Taktik Atış Oyunu
### Proje Planı v1.0

---

## 0. Önemli Not — Telif Hakkı Sınırı

Counter-Strike'ın kendisi (Valve/Hidden Path'e ait): silahlar, karakter modelleri, haritalar (de_dust2 vb.), sesler, HUD tasarımı, logo — hepsi telifli/ticari IP. Bunları GitHub'dan "sökerek" ya da sızdırılmış dosyalardan alarak kullanamam; bu hem yasal hem de platform kurallarım açısından yapamayacağım bir şey.

Yapabileceğim ve yapacağım şey: **CS'in oynanış hissini (taktik, round-bazlı, ekonomi, silah geri tepmesi, karşılıklı çatışma) birebir kopyalayan ama tamamen özgür lisanslı (CC0 / MIT) assetlerle inşa edilmiş, kendi kimliğine sahip bir oyun.** Görsel dil "askeri/taktik" olacak, isimler ve marka kendimize ait olacak.

---

## 1. Teknoloji Kararı — SEÇİM SENDEN BEKLİYOR

Bu, projenin geri kalanının şeklini belirleyecek en kritik karar. İki gerçekçi yol var:

### Yol A — Web/Three.js (tarayıcıda + PWA olarak telefona "yüklenebilir")
- **Render:** Three.js (WebGL2)
- **Fizik:** Rapier3D (Rust→WASM, çok performanslı, karakter controller + raycast + rigidbody desteği var, tarayıcıda native'e yakın hız)
- **Avantaj:** Bu sohbette adım adım kodu birlikte yazabilir, artifact/dosya olarak anında test edebilirsin. Link paylaşımı ile herkes oynayabilir. PWA olarak "ana ekrana ekle" ile mobilde app gibi durur.
- **Dezavantaj:** Mobil GPU'da Three.js + gerçek zamanlı gölgeler + yüksek poly sayısı performans sınırlarına daha hızlı çarpar. "Maksimum kalite" biraz daha kısıtlı (yine de düşük-poly/stilize yaklaşımla çok iyi sonuç alınır).

### Yol B — Godot 4 (native mobil derleme, .apk/.aab çıktısı)
- **Render:** Godot 4.x built-in (Forward+ / Mobile renderer), gerçek dinamik ışıklandırma, gölgeler, post-processing
- **Fizik:** Godot'un kendi Jolt Physics entegrasyonu (endüstri standardı, çok performanslı native fizik)
- **Avantaj:** Gerçek native performans, gerçek bir "oyun motoru" — silah sway, recoil, ragdoll, particle sistemleri çok daha kaliteli olur. Kenney'nin resmi **Starter-Kit-FPS** projesi zaten Godot 4.6 için hazır (MIT lisanslı kod + CC0 asset), doğrudan temel alınabilir.
- **Dezavantaj:** Bu sohbette canlı önizleme yapamayız — Godot projesini sana dosya olarak teslim ederim, sen Godot Editor'de açıp Android/iOS export yaparsın (ya da Claude Code ile yerel makinende benimle birlikte derleriz).

**Önerim:** "Maksimum kalite + maksimum fizik uyumu" istiyorsan **Yol B (Godot)** doğru cevap. Web'de hızlı iterasyon ve anında oynanabilirlik istiyorsan **Yol A (Three.js)**. Aşağıdaki plan her ikisi için de geçerli; sadece motor katmanı değişiyor.

---

## 2. Doğrulanmış Asset Kaynakları (hepsi CC0 / MIT — ticari kullanım dahil serbest)

Bunları zaten inceledim, indirilebilir olduklarını doğruladım:

| Kaynak | İçerik | Lisans | Format |
|---|---|---|---|
| [KenneyNL/Starter-Kit-FPS](https://github.com/KenneyNL/Starter-Kit-FPS) | Hazır Godot 4 FPS iskeleti: karakter controller, düşman AI, silah değiştirme, sesler | MIT (kod) + CC0 (asset) | .glb, .tscn, .ogg |
| [Kenney — Weapon Pack](https://opengameart.org/content/weapon-pack) | 30 silah (tabanca, tüfek, bıçak, roketatar), mermi kovanları | CC0 | OBJ+MTL, Unity paketi |
| [Kenney — Blaster Kit](https://kenney.nl/assets/blaster-kit) | 40 parça silah/hedef/mermi seti | CC0 | .glb |
| [Quaternius — Ultimate Guns Pack](https://poly.pizza/bundle/Ultimate-Guns-Pack-cpgUfI4t2F) | 25 gerçekçi modern silah modeli (tabanca/tüfek/sniper hissi CS'e çok daha yakın) | Ücretsiz, ticari kullanım serbest | FBX + GLB |
| Kenney — City/Prototype/Nature kitleri | Harita parçaları: duvar, platform, konteyner, kum zemin (de_dust tarzı harita inşa edilebilir) | CC0 | .glb |
| Kenney — Impact/UI Audio paketleri | Ateş sesi, adım sesi, isabet sesi, arayüz tıklama sesi | CC0 | .ogg/.wav |

`weapons/kenney-fps-kit` klasörünü zaten bu ortamda indirip inceledim (9.6 MB, `models/*.glb` formatında — Three.js'in GLTFLoader'ı ve Godot ikisi de bu formatı doğrudan okuyor).

---

## 3. Oyun Tasarımı (özet)

- **Görünüm:** Birinci şahıs (silah + eller ekranın altında, önündeki düşmanı ve ortamı görürsün)
- **Round yapısı:** Önceki taktik shooter'da kurduğumuz round/ekonomi sistemi korunuyor — tur başına düşman dalgası, öldürünce nakit, aralarda silah satın alma
- **Hareket:** Sol taraf sanal joystick (yürü/koş), sağ taraf sürükleyerek kamera/nişan çevirme (mobilde "gyro + touch-look" hibrit de değerlendirilebilir)
- **Ateş:** Silaha özel geri tepme (recoil), nişan alma (ADS/zoom — özellikle sniper için), şarjör + yeniden doldurma
- **Fizik:** Gerçek çarpışma kutuları (mermi = raycast/rigidbody), karakter controller yer çekimi + zıplama + eğik yüzeyde kayma, ragdoll/knockback öldürülen düşmanlarda (Godot/Jolt ile çok daha kaliteli)
- **Harita:** Tek bir orta-boy taktik harita (dar sokaklar + açık orta alan + iki "bombsite" benzeri bölge), Kenney city/prototype kitiyle inşa

---

## 4. Adım Adım Yol Haritası

| Faz | İçerik | Çıktı |
|---|---|---|
| **0. Karar** | Platform seçimi (Three.js vs Godot), sanat yönü onayı | Bu belge onaylanır |
| **1. İskelet** | Motor kurulumu, asset importu, boş sahnede FPS kamera + hareket + fizik zemin | Yürüyüp zıplayabildiğin boş bir oda |
| **2. Silah sistemi** | Silah view-model (elde), ateş/recoil/muzzle flash, raycast hasar, şarjör/reload | Tabanca ile hedef vurma |
| **3. Düşman AI** | Basit state machine (devriye → görüş → saldırı → ölüm), navigasyon | Sana ateş eden/üstüne gelen düşmanlar |
| **4. Harita** | Gerçek taktik harita blocking (duvarlar, sığınaklar, iki bölge) | Oynanabilir tek harita |
| **5. Ekonomi/Round** | Round sayacı, ölünce/kazanınca nakit, satın alma menüsü, 3 silah kademesi | Tam round döngüsü |
| **6. Cila** | Ses, HUD (can/mermi/mini-harita), ışıklandırma/post-processing, mobil performans optimizasyonu | "Bitmiş oyun" hissi |
| **7. Mobil paket** | (Godot ise) Android/iOS export ayarları / (Web ise) PWA manifest + touch kontrol son hali | Telefona kurulabilir/erişilebilir sürüm |

---

## 5. Senden Karar Beklenenler

1. **Platform:** Three.js (web, hemen bu sohbette test edilebilir) mi, Godot (native, daha yüksek kalite, ayrı kurulum gerekir) mi?
2. **Sanat yönü:** Kenney'nin stilize/low-poly çizgi mi, yoksa Quaternius'un daha "gerçekçi silüetli" modern silah seti mi ağırlıklı kullanılsın?
3. **Kapsam:** İlk teslimde tek harita + 1 düşman tipi + 3 silah yeterli mi, yoksa daha büyük kapsam mı istiyorsun?

Bu üç soruyu netleştirdikten sonra Faz 1'e geçip gerçek kodu yazmaya başlıyoruz.

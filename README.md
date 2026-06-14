# PRESTRESS-CALC

Aplikasi web **Single Page Application** untuk perhitungan gelagar beton prategang pasca-tarik (Post-Tension I-Girder) — kontrol tegangan SLS berdasarkan prinsip **ACI 318 / SNI 2847**.

## Fitur (MVP v1.0)

- Input geometri I-girder, material, prategang, dan beban via sidebar Streamlit
- Perhitungan sifat penampang (A, Ix, Zt, Zb) metode diskretisasi persegi
- Momen lentur: berat sendiri, SIDL, live load (balok jepit-jepit)
- Kehilangan prategang servis: estimasi 20% (dapat diubah)
- Kontrol tegangan tahap **Transfer** dan **Servis**
- Indikator **AMAN** / **OVERSTRESS**
- Visualisasi penampang dan diagram tegangan (Plotly)

## Instalasi

```bash
cd Desain-Prategang
pip install -r requirements.txt
```

## Menjalankan

```bash
streamlit run app.py
```

## Struktur Proyek

```
Desain-Prategang/
├── app.py                      # UI Streamlit
├── requirements.txt
├── engine/
│   ├── section_properties.py   # Sifat penampang (PRD §3.1)
│   ├── loading.py              # Momen lentur
│   ├── prestress.py            # Gaya prategang & losses
│   ├── stress_check.py         # Kontrol tegangan SLS (PRD §5.1)
│   └── validation.py           # Validasi input
└── README.md
```

## Contoh Input Benchmark

| Parameter | Nilai |
|-----------|-------|
| H | 1200 mm |
| b_top / t_top | 400 / 150 mm |
| t_web | 200 mm |
| b_bot / t_bot | 600 / 200 mm |
| L | 20000 mm |
| f'c / f'ci | 35 / 28 MPa |
| Aps, ρ, e | 1387 mm², 0.75, 400 mm |
| SIDL / LL | 5 / 20 kN/m |

## Asumsi Perhitungan

- Satuan: mm, MPa, kN, kN/m, kN·m
- Balok lentur sederhana jepit-jepit: M = wL²/8
- Penampang non-komposit
- Transfer: Pi = Pj
- Servis: Pe = Pj × (1 − loss%)
- Konvensi tegangan: positif = tarik, negatif = tekan

## Roadmap

- [ ] Profil tendon parabolik / harped (PRD §3.3)
- [ ] Kehilangan prategang detail (PRD §4)
- [ ] Penampang komposit (PRD §3.1)
- [ ] Kapasitas lentur ULS (PRD §5.2)
- [ ] Lendutan & camber (PRD §5.3)

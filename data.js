/* =====================================================================
   ESPECIFICACIONES DE PRODUCTO  ·  valores fijos, no se modifican
   Portado de la hoja "BASE DE DATOS ESTANDAR" (filas 7:32) del libro
   JARABES NUEVO JUNIO 2024.xlsx

   brix      = °Brix estándar del jarabe terminado   (col E)
   volUnidad = Volumen estándar [L] por unidad       (col F)
   dias      = Días de vencimiento                   (col G)
   azReal    = Azúcar real    [Kg/unidad]            (col H)
   azTeorico = Azúcar teórico [Kg/unidad]            (col I)
   azCorte   = Azúcar de corte[Kg/unidad]            (col J)
   ===================================================================== */

const PRODUCTOS = [
  { abrev: "CC",      producto: "Coca-Cola",                       mmi: "CC CP",                 brix: 54.85, volUnidad: 300,     dias: 3.5, azReal: 203.489193, azTeorico: 203.225,   azCorte: 202.980470 },
  { abrev: "CCSA",    producto: "Coca-Cola Zero (Línea)",          mmi: "DB-2130.39-B02",        brix: 1.52,  volUnidad: 304.69,  dias: 1,   azReal: 0,          azTeorico: 0,         azCorte: 0 },
  { abrev: "CCSA PM", producto: "Coca-Cola Sin Azúcar (Post Mix)", mmi: "BBN: DS-2210.39-B02",   brix: 1.63,  volUnidad: 304.69,  dias: 1,   azReal: 0,          azTeorico: 0,         azCorte: 0 },
  { abrev: "CCR",     producto: "Coca-Cola Einstein",              mmi: "CC/B-1.00 B01",         brix: 41.07, volUnidad: 300,     dias: 3.5, azReal: 142.473390, azTeorico: 142.26,    azCorte: 142.117207 },
  { abrev: "SPLL",    producto: "Sprite",                          mmi: "SP-0156.0-B01",         brix: 53.26, volUnidad: 312.8,   dias: 3.5, azReal: 204.465214, azTeorico: 204.0571,  azCorte: 203.954051 },
  { abrev: "SPSA",    producto: "Sprite Sin Azúcar (Fenix)",       mmi: "SP/D-216.50-B01",       brix: 2.11,  volUnidad: 312.5,   dias: 1,   azReal: 0,          azTeorico: 0,         azCorte: 0 },
  { abrev: "FNR",     producto: "Fanta Naranja",                   mmi: "OR/B-1109.01-B01",      brix: 34.02, volUnidad: 370.51,  dias: 3.5, azReal: 140.210000, azTeorico: 140,       azCorte: 139.859475 },
  { abrev: "FNZ",     producto: "Fanta Zero (Post Mix)",           mmi: "OR/D-1113.50/001",      brix: 1.34,  volUnidad: 370.37,  dias: 1,   azReal: 0,          azTeorico: 0,         azCorte: 0 },
  { abrev: "FYR",     producto: "Fanta Papaya",                    mmi: "PY/B-0001.20-B01",      brix: 33.53, volUnidad: 370.5,   dias: 3.5, azReal: 140.210000, azTeorico: 140,       azCorte: 139.859475 },
  { abrev: "FTGR",    producto: "Fanta Guaraná",                   mmi: "GU/B-0054.10-B01",      brix: 33.73, volUnidad: 370.5,   dias: 3.5, azReal: 140.210000, azTeorico: 140,       azCorte: 139.859475 },
  { abrev: "FLR",     producto: "Fanta Limón Reformulado",         mmi: "BBN:LE/B-0538.10-B01",  brix: 37.06, volUnidad: 336.64,  dias: 3.5, azReal: 141.541995, azTeorico: 141.33,    azCorte: 141.188140 },
  { abrev: "FMR",     producto: "Fanta Mandarina Reformulado",     mmi: "MA/B-0034.21-B01",      brix: 34.36, volUnidad: 370.51,  dias: 3.5, azReal: 140.168000, azTeorico: 140,       azCorte: 139.817580 },
  { abrev: "SBDR",    producto: "Simba Durazno",                   mmi: "PE/B-0005.10-B01",      brix: 34.07, volUnidad: 370.51,  dias: 3.5, azReal: 140.210000, azTeorico: 140,       azCorte: 139.859475 },
  { abrev: "SBZR",    producto: "Simba Manzana Verde",             mmi: "AP/B-0644.00 B-01",     brix: 39.4,  volUnidad: 312.65,  dias: 3.5, azReal: 140.210000, azTeorico: 140,       azCorte: 139.859475 },
  { abrev: "SBPR",    producto: "Simba Piña",                      mmi: "PA/B-0028.10 B01",      brix: 34.28, volUnidad: 370.51,  dias: 3.5, azReal: 140.210000, azTeorico: 140,       azCorte: 139.859475 },
  { abrev: "SBPOR",   producto: "Simba Pomelo",                    mmi: "GF/B-0154.10 B-02",     brix: 32.76, volUnidad: 186.87,  dias: 3.5, azReal: 65.478070,  azTeorico: 65.38,     azCorte: 65.314375 },
  { abrev: "PWI4MA",  producto: "Powerade ION4 Mora Azul",         mmi: "FP/Q/V-0419,60 dn#01",  brix: 26.63, volUnidad: 444.55,  dias: 1,   azReal: 120.144000, azTeorico: 120,       azCorte: 119.843640 },
  { abrev: "PWI4MF",  producto: "Powerade ION4 Multifrutas",       mmi: "FP/Q/V-0567.00 dn#01",  brix: 26.42, volUnidad: 444.56,  dias: 1,   azReal: 120.144000, azTeorico: 120,       azCorte: 119.843640 },
  { abrev: "AQPRR",   producto: "Aquarius Pera",                   mmi: "PR/B-0453.00-B02",      brix: 30.87, volUnidad: 767.63,  dias: 1,   azReal: 236.654450, azTeorico: 236.3,     azCorte: 236.062814 },
  { abrev: "AQPO",    producto: "Aquarius Pomelo",                 mmi: "GF/B-0357.10",          brix: 31.83, volUnidad: 454.7,   dias: 1,   azReal: 139.709250, azTeorico: 139.5,     azCorte: 139.359977 },
  { abrev: "DVFH",    producto: "Del Valle Fresh Citrus",          mmi: "CI/B/V-0169.10-B01",    brix: 19.38, volUnidad: 460.41,  dias: 1,   azReal: 80.120000,  azTeorico: 80,        azCorte: 79.919700 },
  { abrev: "DVFP",    producto: "Del Valle Fresh Fruit Punch",     mmi: "PF/PA/B-0008.00-B01",   brix: 19.13, volUnidad: 418.24,  dias: 1,   azReal: 72.608750,  azTeorico: 72.5,      azCorte: 72.427228 },
  { abrev: "DVMZ",    producto: "Del Valle Manzana",               mmi: "AP/A/B-0808.00 - B01",  brix: 25.58, volUnidad: 1776.74, dias: 1,   azReal: 404.459023, azTeorico: 403.65172, azCorte: 403.447876 },
  { abrev: "DVDZ",    producto: "Del Valle Durazno",               mmi: "PE/A/B-0539.00 - B01",  brix: 18.55, volUnidad: 1702.35, dias: 1,   azReal: 225.358227, azTeorico: 224.90841, azCorte: 224.794831 },
  { abrev: "GAR",     producto: "Ginger Ale Schweppes",            mmi: "BBN:GA/B-0010.72-B01",  brix: 26.4,  volUnidad: 312.55,  dias: 3.5, azReal: 88.182075,  azTeorico: 88.05,     azCorte: 87.961620 },
  { abrev: "AT",      producto: "Agua Tónica Schweppes",           mmi: "BBN: TW/4-0082.00-B02", brix: 52.36, volUnidad: 285.96,  dias: 3.5, azReal: 178.563718, azTeorico: 177.672,   azCorte: 178.117309 }
];

/* Operadores registrados en el histórico de la planilla */
const OPERADORES = ["ALFREDO","ALVARO","C.TOLA","ELION","ELVIS F.","GARNICA","GROVER M.",
                    "LOPEZ","MARCELO A.","MIGUEL L.","RICARDO","RUBEN","WILBER"];

/* Tolerancias de liberación */
const TOL = {
  volumen: 0.5,   // ±0,5 %  sobre el volumen teórico
  brix:    0.30   // ±0,30 °Bx sobre el estándar
};

/* Densidad del agua a 20 °C */
const RHO_AGUA = 0.9982;

/* °Brix habitual del jarabe simple del disolutor */
const BRIX_JS_DEFAULT = 60;

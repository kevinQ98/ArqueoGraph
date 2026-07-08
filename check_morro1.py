#!/usr/bin/env python3
import json

# Check Mn file
with open(r'd:\Documetos Jessica\MAESTRIA\arqueograph_local_fase_7\backend\data\morro1_analisis_quimicos_Mn_costilla.json') as f:
    data_mn = json.load(f)

# Check referencia file
with open(r'd:\Documetos Jessica\MAESTRIA\arqueograph_local_fase_7\backend\data\morro1_referencia.json') as f:
    data_ref = json.load(f)

# Check paleopatologia file
with open(r'd:\Documetos Jessica\MAESTRIA\arqueograph_local_fase_7\backend\data\morro1_paleopatologia.json') as f:
    data_paleo = json.load(f)

print("=== MORRO1 ANALISIS QUIMICOS Mn ===")
casos_mn = data_mn.get('morro1_analisis_quimicos_Mn', {}).get('casos', [])
females_mn = [c for c in casos_mn if c['individuo']['sexo'] == 'femenino' and c['individuo']['grupo_edad'] == 'adulto']
print(f"Total mujeres adultas en Mn: {len(females_mn)}")
for c in females_mn:
    mn_val = c['analisis_quimicos']['elementos']['Mn']['valor']
    print(f"  {c['id']}: edad={c['individuo']['edad']}, Mn={mn_val}")

print("\n=== MORRO1 REFERENCIA ===")
casos_ref = data_ref.get('morro_1', {}).get('casos', [])
females_ref = [c for c in casos_ref if c['individuo']['sexo'] == 'femenino' and c['individuo']['grupo_edad'] == 'adulto']
print(f"Total mujeres adultas en referencia: {len(females_ref)}")
for c in females_ref:
    print(f"  {c['id']}: edad={c['individuo']['edad']}")

print("\n=== MORRO1 PALEOPATOLOGIA ===")
casos_paleo = data_paleo.get('morro1_paleopatologia', {}).get('casos', [])
females_paleo = [c for c in casos_paleo if c['individuo']['sexo'] == 'femenino' and c['individuo']['grupo_edad'] == 'adulto']
print(f"Total mujeres adultas en paleopatologia: {len(females_paleo)}")
for c in females_paleo:
    print(f"  {c['id']}: edad={c['individuo']['edad']}")

print("\n=== COMPARACION ===")
ids_mn = {c['id'] for c in females_mn}
ids_ref = {c['id'] for c in females_ref}
ids_paleo = {c['id'] for c in females_paleo}

print(f"IDs en Mn: {sorted(ids_mn)}")
print(f"IDs en Ref: {sorted(ids_ref)}")
print(f"IDs en Paleo: {sorted(ids_paleo)}")
print(f"Diferencias Mn vs Ref: {ids_ref - ids_mn}")
print(f"Diferencias Ref vs Mn: {ids_mn - ids_ref}")

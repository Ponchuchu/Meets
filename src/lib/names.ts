// Падежи имён для текстов: «Позвать Игоря», «от Дениса», «с Айнурой».
/** Родительный / винительный для одушевлённых: Игорь → Игоря, Денис → Дениса, Айнура → Айнуру (вин.) / Айнуры (род.). */
export function genitive(name: string): string {
  if (/ь$/.test(name)) return name.slice(0, -1) + 'я';
  if (/й$/.test(name)) return name.slice(0, -1) + 'я';
  if (/[гкхжшщч]а$/.test(name)) return name.slice(0, -1) + 'и';
  if (/[ая]$/.test(name)) return name.slice(0, -1) + 'ы';
  return name + 'а';
}

export function accusative(name: string): string {
  if (/а$/.test(name)) return name.slice(0, -1) + 'у';
  if (/я$/.test(name)) return name.slice(0, -1) + 'ю';
  return genitive(name);
}

const decimal = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const heltal = new Intl.NumberFormat('da-DK', {
  maximumFractionDigits: 0
});

export function kilo(gram: number, decimaler = 2): string {
  return new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimaler
  }).format(gram / 1000);
}

export function gram(vaegt: number): string {
  return heltal.format(vaegt);
}

export function beloeb(kroner: number): string {
  return heltal.format(Math.round(kroner));
}

export function tal(vaerdi: number): string {
  return decimal.format(vaerdi);
}

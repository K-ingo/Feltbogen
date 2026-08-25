import { describe, it, expect } from 'vitest';
import { ClientResponseError } from 'pocketbase';
import { loginFejlBesked, fejlDetaljer } from './pbFejl';

const URL_LOGIN = 'https://server.example/api/collections/users/auth-with-password';

// Fejlen serveren ville have sendt, pakket som klienten selv pakker den — så
// testene holder på det klienten faktisk giver os, ikke på et objekt vi har
// fundet på.
function serverfejl(status: number, krop: unknown): ClientResponseError {
  return new ClientResponseError({
    url: URL_LOGIN,
    status,
    response: krop
  });
}

describe('loginFejlBesked', () => {
  it('siger at email eller password er forkert', () => {
    const e = serverfejl(400, { code: 400, message: 'Failed to authenticate.', data: {} });

    expect(loginFejlBesked(e)).toBe('Forkert email eller password');
  });

  // Den vigtige skelnen: PocketBase svarer 400 på både forkerte oplysninger og
  // på et felt der ikke validerer, og de to skal ikke have samme besked. Uden
  // det her stod der "Something went wrong while processing your request." på
  // skærmen — engelsk, og uden noget at rette.
  it('peger på feltet når serveren afviser et bestemt felt', () => {
    const e = serverfejl(400, {
      code: 400,
      message: 'Something went wrong while processing your request.',
      data: { identity: { code: 'validation_required', message: 'Cannot be blank.' } }
    });

    expect(loginFejlBesked(e)).toBe('Udfyld email');
  });

  it('oversætter et for kort password ved oprettelse', () => {
    const e = serverfejl(400, {
      code: 400,
      message: 'Failed to create record.',
      data: { password: { code: 'validation_length_out_of_range', message: 'The length must be between 8 and 72.' } }
    });

    expect(loginFejlBesked(e)).toBe('Password skal være mindst 8 tegn');
  });

  it('oversætter en email der allerede er brugt', () => {
    const e = serverfejl(400, {
      code: 400,
      message: 'Failed to create record.',
      data: { email: { code: 'validation_not_unique', message: 'Value must be unique.' } }
    });

    expect(loginFejlBesked(e)).toBe('Email er allerede registreret');
  });

  it('nævner feltet selv når koden er ukendt', () => {
    const e = serverfejl(400, {
      code: 400,
      message: 'Something went wrong while processing your request.',
      data: { password: { code: 'validation_noget_nyt', message: 'Nope.' } }
    });

    expect(loginFejlBesked(e)).toBe('Password: Nope.');
  });

  // En server der ikke kunne nås er ikke et afvist login. Klienten pakker en
  // fejlet fetch som status 0 med beskeden "Something went wrong." — den ville
  // ellers stå på skærmen som om kodeordet var forkert.
  it('skelner en server der ikke kunne nås fra et afvist login', () => {
    const e = new ClientResponseError(new TypeError('Failed to fetch'));

    expect(e.status).toBe(0);
    expect(loginFejlBesked(e)).toBe('Kunne ikke nå serveren. Tjek din forbindelse og prøv igen.');
  });

  it('beder om at prøve igen når serveren har problemer', () => {
    const e = serverfejl(503, { code: 503, message: 'Service unavailable.' });

    expect(loginFejlBesked(e)).toBe('Serveren har problemer lige nu. Prøv igen om lidt.');
  });

  it('falder tilbage på serverens egen besked', () => {
    const e = serverfejl(400, { code: 400, message: 'Noget helt tredje.', data: {} });

    expect(loginFejlBesked(e)).toBe('Noget helt tredje.');
  });

  it('klarer en fejl der slet ikke kommer fra PocketBase', () => {
    expect(loginFejlBesked(new Error('Kunne ikke logge ind'))).toBe('Kunne ikke logge ind');
    expect(loginFejlBesked(null)).toBe('Der skete en fejl');
  });
});

describe('fejlDetaljer', () => {
  // Skærmdumpet der startede det hele viste "400 Bad Request" og intet andet.
  // Status, URL, besked og feltliste skal med, ellers kan en fejl der kun sker
  // på én telefon ikke fejlsøges bagefter.
  it('samler status, URL, besked og feltliste', () => {
    const e = serverfejl(400, {
      code: 400,
      message: 'Failed to authenticate.',
      data: { identity: { code: 'validation_required', message: 'Cannot be blank.' } }
    });

    expect(fejlDetaljer(e)).toEqual({
      status: 400,
      url: URL_LOGIN,
      besked: 'Failed to authenticate.',
      felter: { identity: { code: 'validation_required', message: 'Cannot be blank.' } }
    });
  });

  it('lader en fejl der ikke er fra PocketBase gå uændret igennem', () => {
    const e = new Error('noget andet');

    expect(fejlDetaljer(e)).toBe(e);
  });
});

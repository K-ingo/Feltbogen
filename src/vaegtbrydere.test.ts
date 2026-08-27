import { describe, it, expect } from 'vitest';
import {
  MINDSTE_BESPARELSE,
  alternativerTil,
  manglendeTags,
  samletBesparelse,
  vaegtbrydere,
  vaegtresultat,
  bedsteBytter,
  byt
} from './vaegtbrydere';
import { lavGruppe, lavItem, lavTur } from './test/data';

const paaTuren = (...uids: string[]) => new Set(uids);

describe('alternativerTil', () => {
  const tung = lavItem({ uid: 'u-tung', navn: 'TTTM', vaegt_g: 900, tags: ['tarp'] });

  it('finder lettere gear med et fælles tag', () => {
    const let_ = lavItem({ uid: 'u-let', navn: 'DD SuperLight', vaegt_g: 480, tags: ['tarp'] });

    const [a] = alternativerTil(tung, [tung, let_], paaTuren('u-tung'));

    expect(a.item.navn).toBe('DD SuperLight');
    expect(a.sparet_g).toBe(420);
    expect(a.faelles).toEqual(['tarp']);
  });

  // At foreslå en kniv i stedet for en sovepose ville være tåbeligt, uanset
  // hvor meget lettere kniven er.
  it('kræver mindst ét fælles tag', () => {
    const uden = lavItem({ uid: 'u-kniv', navn: 'Kniv', vaegt_g: 100, tags: ['skarpt'] });
    expect(alternativerTil(tung, [tung, uden], paaTuren('u-tung'))).toEqual([]);
  });

  it('kræver at besparelsen er mærkbar', () => {
    // 10 % lettere er under grænsen.
    const naesten = lavItem({ uid: 'u-1', vaegt_g: 810, tags: ['tarp'] });
    expect(alternativerTil(tung, [tung, naesten], paaTuren('u-tung'))).toEqual([]);

    const netop = lavItem({ uid: 'u-2', vaegt_g: 900 * (1 - MINDSTE_BESPARELSE), tags: ['tarp'] });
    expect(alternativerTil(tung, [tung, netop], paaTuren('u-tung'))).toHaveLength(1);
  });

  it('foreslår ikke noget der allerede er med på turen', () => {
    const med = lavItem({ uid: 'u-med', vaegt_g: 400, tags: ['tarp'] });
    expect(alternativerTil(tung, [tung, med], paaTuren('u-tung', 'u-med'))).toEqual([]);
  });

  it('foreslår ikke gear man ikke ejer', () => {
    const solgt = lavItem({ uid: 'u-solgt', status: 'solgt', vaegt_g: 400, tags: ['tarp'] });
    const overvejer = lavItem({ uid: 'u-ov', status: 'overvejer', vaegt_g: 400, tags: ['tarp'] });

    expect(alternativerTil(tung, [tung, solgt, overvejer], paaTuren('u-tung'))).toEqual([]);
  });

  it('foreslår ikke sig selv', () => {
    expect(alternativerTil(tung, [tung], paaTuren('u-tung'))).toEqual([]);
  });

  // Uden tags er der ikke noget at matche på, og uden vægt er der ikke noget
  // at spare.
  it('tier om gear uden tags eller uden vægt', () => {
    const utagget = lavItem({ uid: 'u-1', vaegt_g: 900, tags: [] });
    const vaegtloes = lavItem({ uid: 'u-2', vaegt_g: 0, tags: ['tarp'] });
    const let_ = lavItem({ uid: 'u-3', vaegt_g: 100, tags: ['tarp'] });

    expect(alternativerTil(utagget, [utagget, let_], paaTuren('u-1'))).toEqual([]);
    expect(alternativerTil(vaegtloes, [vaegtloes, let_], paaTuren('u-2'))).toEqual([]);
  });

  it('ser bort fra alternativer uden vægt — de er ikke vejet endnu', () => {
    const ukendt = lavItem({ uid: 'u-ny', vaegt_g: 0, tags: ['tarp'] });
    expect(alternativerTil(tung, [tung, ukendt], paaTuren('u-tung'))).toEqual([]);
  });

  it('sætter den største besparelse først', () => {
    const lidt = lavItem({ uid: 'u-1', navn: 'Lidt', vaegt_g: 700, tags: ['tarp'] });
    const meget = lavItem({ uid: 'u-2', navn: 'Meget', vaegt_g: 300, tags: ['tarp'] });

    const liste = alternativerTil(tung, [tung, lidt, meget], paaTuren('u-tung'));
    expect(liste.map((a) => a.item.navn)).toEqual(['Meget', 'Lidt']);
  });

  it('holder listen kort nok til at være et forslag', () => {
    const mange = Array.from({ length: 8 }, (_, n) =>
      lavItem({ uid: `u-${n}`, vaegt_g: 100 + n, tags: ['tarp'] }));

    expect(alternativerTil(tung, [tung, ...mange], paaTuren('u-tung'))).toHaveLength(3);
  });
});

describe('vaegtbrydere', () => {
  it('kigger på de tungeste og springer dem over uden alternativ', () => {
    const tarp = lavItem({ uid: 'u-tarp', navn: 'Tarp', vaegt_g: 900, tags: ['tarp'] });
    const kniv = lavItem({ uid: 'u-kniv', navn: 'Kniv', vaegt_g: 200, tags: ['skarpt'] });
    const letTarp = lavItem({ uid: 'u-let', navn: 'Let tarp', vaegt_g: 400, tags: ['tarp'] });

    const tur = lavTur({ loese_item_ids: ['u-tarp', 'u-kniv'] });
    const brydere = vaegtbrydere(tur, [], [tarp, kniv, letTarp], [tarp, kniv]);

    expect(brydere).toHaveLength(1);
    expect(brydere[0].tung.navn).toBe('Tarp');
  });

  it('regner den samlede besparelse på det bedste bytte pr. item', () => {
    const a = lavItem({ uid: 'u-a', vaegt_g: 900, tags: ['tarp'] });
    const b = lavItem({ uid: 'u-b', vaegt_g: 800, tags: ['pose'] });
    const letA = lavItem({ uid: 'u-la', vaegt_g: 400, tags: ['tarp'] });
    const letB = lavItem({ uid: 'u-lb', vaegt_g: 500, tags: ['pose'] });

    const tur = lavTur({ loese_item_ids: ['u-a', 'u-b'] });
    const brydere = vaegtbrydere(tur, [], [a, b, letA, letB], [a, b]);

    expect(samletBesparelse(brydere)).toBe(800);
  });

  it('tæller gear i en valgt gruppe som værende på turen', () => {
    const tung = lavItem({ uid: 'u-tung', vaegt_g: 900, tags: ['tarp'] });
    const let_ = lavItem({ uid: 'u-let', vaegt_g: 400, tags: ['tarp'] });
    const gruppe = lavGruppe({ uid: 'g-1', item_ids: ['u-let'] });
    const tur = lavTur({ loese_item_ids: ['u-tung'], gruppe_ids: ['g-1'] });

    expect(vaegtbrydere(tur, [gruppe], [tung, let_], [tung, let_])).toEqual([]);
  });

  it('siger ingenting om en tom pakkeliste', () => {
    expect(vaegtbrydere(lavTur(), [], [lavItem()], [])).toEqual([]);
    expect(samletBesparelse([])).toBe(0);
  });

  it('forklarer hvad motoren rent faktisk har sammenlignet', () => {
    const tung = lavItem({ uid: 'u-tung', navn: 'TTTM', vaegt_g: 900, tags: ['tarp'] });
    const let_ = lavItem({ uid: 'u-let', vaegt_g: 400, tags: ['tarp'] });
    const tur = lavTur({ loese_item_ids: ['u-tung'] });

    const [b] = vaegtbrydere(tur, [], [tung, let_], [tung]);

    expect(b.begrundelse).toContain('mindst ét tag');
    // Motoren sammenligner nu tre ting og ikke to. Begrundelsen skal sige
    // alle tre — ellers lover den mindre, end den gør.
    expect(b.begrundelse).toContain('kun tags, gram og din egen vurdering');
  });
});

describe('manglendeTags', () => {
  // Fejlen man ellers aldrig opdager: motoren tier, og man tror den ikke har
  // noget at sige — i stedet for at den mangler et tag at sige det med.
  it('finder turens kendetegn som ingen gruppe har', () => {
    const gruppe = lavGruppe({ tags: ['skov', 'solo'] });
    const tur = lavTur({ overnatning: 'telt', terraen: 'skov', aktivitet: 'kano', personer: 1 });

    expect(manglendeTags(tur, [gruppe]).sort()).toEqual(['kano', 'telt']);
  });

  it('siger ingenting når alt er dækket', () => {
    const gruppe = lavGruppe({ tags: ['telt', 'skov', 'bushcraft', 'solo'] });
    const tur = lavTur({ overnatning: 'telt', terraen: 'skov', aktivitet: 'bushcraft', personer: 1 });

    expect(manglendeTags(tur, [gruppe])).toEqual([]);
  });

  it('regner alle turens kendetegn som manglende uden grupper', () => {
    expect(manglendeTags(lavTur(), [])).toHaveLength(4);
  });
});


describe('vurderingen holder motoren tilbage', () => {
  it('foreslår ikke at skifte grej ud man har sagt god for', () => {
    const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 4000, tags: ['ly'], vurdering: 5 });
    const let_ = lavItem({ navn: 'Tarp', vaegt_g: 600, tags: ['ly'] });
    const tur = lavTur({ loese_item_ids: [tungt.uid] });

    expect(vaegtbrydere(tur, [], [tungt, let_], [tungt])).toEqual([]);
  });

  it('foreslår det stadig når man ikke har taget stilling', () => {
    const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 4000, tags: ['ly'], vurdering: null });
    const let_ = lavItem({ navn: 'Tarp', vaegt_g: 600, tags: ['ly'] });
    const tur = lavTur({ loese_item_ids: [tungt.uid] });

    expect(vaegtbrydere(tur, [], [tungt, let_], [tungt])).toHaveLength(1);
  });

  it('foreslår det stadig når vurderingen er lav', () => {
    const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 4000, tags: ['ly'], vurdering: 2 });
    const let_ = lavItem({ navn: 'Tarp', vaegt_g: 600, tags: ['ly'] });
    const tur = lavTur({ loese_item_ids: [tungt.uid] });

    expect(vaegtbrydere(tur, [], [tungt, let_], [tungt])).toHaveLength(1);
  });

  it('holder kun det vurderede tilbage, ikke resten af turen', () => {
    const elsket = lavItem({ navn: 'Dyne', vaegt_g: 4000, tags: ['sov'], vurdering: 5 });
    const tungt = lavItem({ navn: 'Stort telt', vaegt_g: 3000, tags: ['ly'] });
    const let_ = lavItem({ navn: 'Tarp', vaegt_g: 600, tags: ['ly'] });
    const tur = lavTur({ loese_item_ids: [elsket.uid, tungt.uid] });

    const brydere = vaegtbrydere(tur, [], [elsket, tungt, let_], [elsket, tungt]);

    expect(brydere.map((b) => b.tung.navn)).toEqual(['Stort telt']);
  });
});

// ─────────────────────────────────────────────
// Risiko (specens §7.2)
//
// Uden den vejer et bytte, der bare er lettere, lige så tungt som et bytte,
// der kan det samme.
// ─────────────────────────────────────────────

describe('risikoen ved et bytte', () => {
  const tung = lavItem({ uid: 'u-tung', navn: 'Telt', vaegt_g: 2400, tags: ['telt', 'to-personer'] });

  const risikoenVed = (let_: ReturnType<typeof lavItem>) =>
    alternativerTil(tung, [tung, let_], paaTuren('u-tung'))[0];

  it('kalder et fuldt dækkende og velvurderet bytte for lavt', () => {
    const a = risikoenVed(lavItem({
      uid: 'u-let', navn: 'Letvægtstelt', vaegt_g: 1200,
      tags: ['telt', 'to-personer'], vurdering: 5
    }));

    expect(a.daekning).toBe(1);
    expect(a.risiko).toBe('lav');
    expect(a.konsekvens).toContain('5 stjerner');
  });

  // Appen ved ikke om det lette telt holder til blæsten. Uden en vurdering
  // bliver et bytte aldrig til "lav" af sig selv.
  it('holder et uvurderet bytte på mellem, selv når det dækker alt', () => {
    const a = risikoenVed(lavItem({
      uid: 'u-let', vaegt_g: 1200, tags: ['telt', 'to-personer'], vurdering: null
    }));

    expect(a.daekning).toBe(1);
    expect(a.risiko).toBe('mellem');
    expect(a.konsekvens).toContain('ikke vurderet');
  });

  it('kalder et halvt dækkende bytte for mellem og siger hvad der mangler', () => {
    const a = risikoenVed(lavItem({ uid: 'u-let', navn: 'Soloteltet', vaegt_g: 900, tags: ['telt'] }));

    expect(a.daekning).toBe(0.5);
    expect(a.risiko).toBe('mellem');
    expect(a.konsekvens).toContain('"to-personer"');
  });

  it('kalder et tyndt match for højt', () => {
    const bredTung = lavItem({ uid: 'u-b', navn: 'Telt', vaegt_g: 2400, tags: ['telt', 'to-personer', 'vinter'] });
    const [a] = alternativerTil(
      bredTung,
      [bredTung, lavItem({ uid: 'u-let', navn: 'Tarp', vaegt_g: 400, tags: ['telt'] })],
      paaTuren('u-b')
    );

    expect(a.risiko).toBe('hoej');
  });

  // Lettere er ikke bedre, hvis man selv har været utilfreds med det.
  it('kalder et bytte til noget man har givet to stjerner for højt', () => {
    const a = risikoenVed(lavItem({
      uid: 'u-let', navn: 'Billigteltet', vaegt_g: 1200,
      tags: ['telt', 'to-personer'], vurdering: 2
    }));

    expect(a.risiko).toBe('hoej');
    expect(a.konsekvens).toContain('2 stjerner');
  });

  // Rækkefølgen betyder noget nu, hvor "byt alle" tager det øverste.
  it('sætter det sikreste bytte først, også når et vovet sparer mere', () => {
    const sikkert = lavItem({ uid: 'u-sikkert', navn: 'Sikkert', vaegt_g: 1200, tags: ['telt', 'to-personer'], vurdering: 5 });
    const vovet = lavItem({ uid: 'u-vovet', navn: 'Vovet', vaegt_g: 300, tags: ['telt'] });

    const raekkefoelge = alternativerTil(tung, [tung, vovet, sikkert], paaTuren('u-tung'));

    expect(raekkefoelge.map((a) => a.item.navn)).toEqual(['Sikkert', 'Vovet']);
    expect(raekkefoelge[1].sparet_g).toBeGreaterThan(raekkefoelge[0].sparet_g);
  });
});

describe('vaegtresultat', () => {
  const tung = lavItem({ uid: 'u-tung', navn: 'Telt', vaegt_g: 2400, tags: ['telt'] });
  const let_ = lavItem({ uid: 'u-let', navn: 'Tarp', vaegt_g: 900, tags: ['telt'] });
  const tur = lavTur({ loese_item_ids: ['u-tung'] });

  it('samler vægten, forslagene og besparelsen ét sted', () => {
    const r = vaegtresultat(tur, [], [tung, let_], [tung]);

    expect(r.nuvaerende_g).toBe(2400);
    expect(r.brydere).toHaveLength(1);
    expect(r.potentiel_besparelse_g).toBe(1500);
  });

  it('tæller antallet med i den nuværende vægt', () => {
    const to = lavItem({ uid: 'u-to', navn: 'Stavene', vaegt_g: 200, antal: 2, tags: [] });
    expect(vaegtresultat(tur, [], [to], [to]).nuvaerende_g).toBe(400);
  });

  it('siger ingenting når der ikke er noget at hente', () => {
    const r = vaegtresultat(tur, [], [tung], [tung]);

    expect(r.brydere).toEqual([]);
    expect(r.potentiel_besparelse_g).toBe(0);
  });
});

describe('bedsteBytter', () => {
  const telt = lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2400, tags: ['telt'] });
  const pose = lavItem({ uid: 'u-pose', navn: 'Sovepose', vaegt_g: 1600, tags: ['telt'] });
  const tarp = lavItem({ uid: 'u-tarp', navn: 'Tarp', vaegt_g: 700, tags: ['telt'] });

  // Det samme lette stykke gear kan være det bedste bud på to tunge ting. To
  // ud af tasken og én ind, og man står uden den ene i skoven.
  it('bruger ikke det samme lette gear til to bytter', () => {
    const tur = lavTur({ loese_item_ids: ['u-telt', 'u-pose'] });
    const brydere = vaegtbrydere(tur, [], [telt, pose, tarp], [telt, pose]);

    expect(brydere).toHaveLength(2);

    const bytter = bedsteBytter(brydere);
    expect(bytter).toHaveLength(1);
    expect(bytter[0].tung.navn).toBe('Telt');
    expect(bytter[0].lette.navn).toBe('Tarp');
  });

  it('regner besparelsen af de bytter der faktisk kan tages', () => {
    const tur = lavTur({ loese_item_ids: ['u-telt', 'u-pose'] });
    const brydere = vaegtbrydere(tur, [], [telt, pose, tarp], [telt, pose]);

    // 2400 − 700, og ikke også 1600 − 700 for soveposen: tarpen er brugt.
    expect(samletBesparelse(brydere)).toBe(1700);
  });
});

describe('byt', () => {
  const telt = lavItem({ uid: 'u-telt', navn: 'Telt', vaegt_g: 2400, tags: ['telt'] });
  const tarp = lavItem({ uid: 'u-tarp', navn: 'Tarp', vaegt_g: 700, tags: ['telt'] });
  const bytte = { tung: telt, lette: tarp, sparet_g: 1700, risiko: 'mellem' as const };

  it('lægger det lette til og tager det tunge af', () => {
    const tur = lavTur({ loese_item_ids: ['u-telt', 'u-andet'] });
    const { aendringer, uloeste } = byt(tur, [bytte]);

    expect(aendringer.loese_item_ids).toEqual(['u-andet', 'u-tarp']);
    expect(uloeste).toEqual([]);
  });

  // Det var her, det gamle "Tilføj" slap: begge dele stod på listen, og
  // vægten var gået op i stedet for ned.
  it('tager det tunge ud af tasken igen', () => {
    const tur = lavTur({ loese_item_ids: ['u-telt'], pakkede_item_uids: ['u-telt'] });
    expect(byt(tur, [bytte]).aendringer.pakkede_item_uids).toEqual([]);
  });

  it('tager det tunge fra den der skulle bære det', () => {
    const tur = lavTur({
      loese_item_ids: ['u-telt'],
      deltagere: [{
        id: 'd1', navn: 'Emil', overnatning: null,
        personligt_gear_ids: ['u-andet'], baerer_delt_ids: ['u-telt'], person_uid: ''
      }]
    });

    const { aendringer } = byt(tur, [bytte]);
    expect(aendringer.deltagere?.[0].baerer_delt_ids).toEqual([]);
    expect(aendringer.deltagere?.[0].personligt_gear_ids).toEqual(['u-andet']);
  });

  it('rører ikke deltagerne når der ikke blev fjernet noget', () => {
    const fraSaet = lavTur({ gruppe_ids: ['g1'], deltagere: [] });
    expect(byt(fraSaet, [bytte]).aendringer.deltagere).toBeUndefined();
  });

  // Et sæt er valgt som et sæt. Så lægges det lette til, og skærmen får at
  // vide, at byttet ikke blev helt.
  it('siger til når det tunge kom fra et grejsæt og ikke kan tages af', () => {
    const tur = lavTur({ gruppe_ids: ['g1'], loese_item_ids: [] });
    const { aendringer, uloeste } = byt(tur, [bytte]);

    expect(aendringer.loese_item_ids).toEqual(['u-tarp']);
    expect(uloeste.map((i) => i.navn)).toEqual(['Telt']);
  });

  it('tager flere bytter på én gang', () => {
    const pose = lavItem({ uid: 'u-pose', navn: 'Sovepose', vaegt_g: 1600, tags: ['sov'] });
    const dun = lavItem({ uid: 'u-dun', navn: 'Dunpose', vaegt_g: 800, tags: ['sov'] });
    const tur = lavTur({ loese_item_ids: ['u-telt', 'u-pose'], pakkede_item_uids: ['u-telt', 'u-pose'] });

    const { aendringer } = byt(tur, [
      bytte,
      { tung: pose, lette: dun, sparet_g: 800, risiko: 'mellem' as const }
    ]);

    expect(aendringer.loese_item_ids).toEqual(['u-tarp', 'u-dun']);
    expect(aendringer.pakkede_item_uids).toEqual([]);
  });
});

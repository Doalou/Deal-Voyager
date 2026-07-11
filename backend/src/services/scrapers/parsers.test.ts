import assert from 'node:assert/strict';
import test from 'node:test';
import { operatorDefinitions, validateAndNormalizePlans } from '../scraper.service';
import { parseAkeoText } from './akeo.scraper';
import { parseFranceTelephoneText } from './francetelephone.scraper';
import { parseSymaText } from './syma.scraper';
import { parseTelecoopText } from './telecoop.scraper';
import { extractVisibleTextFromHtml } from './utils';

test('le registre contient 18 opérateurs uniques et complets', () => {
  assert.equal(operatorDefinitions.length, 18);
  assert.equal(new Set(operatorDefinitions.map((definition) => definition.name)).size, 18);
  for (const definition of operatorDefinitions) {
    assert.ok(definition.url.startsWith('https://'));
    assert.ok(definition.networks.length > 0);
    assert.ok(definition.minOffers > 0);
  }
});

test('les 18 opérateurs sont associés à leurs réseaux MNO', () => {
  const expectedNetworks = new Map<string, readonly string[]>([
    ['Sosh', ['Orange']],
    ['RED by SFR', ['SFR']],
    ['B&You', ['Bouygues Telecom']],
    ['Free Mobile', ['Free']],
    ['YouPrice', ['Orange', 'SFR', 'Bouygues Telecom']],
    ['Coriolis', ['SFR']],
    ['La Poste Mobile', ['Bouygues Telecom']],
    ['NRJ Mobile', ['Bouygues Telecom']],
    ['Auchan Telecom', ['Bouygues Telecom']],
    ['Cdiscount Mobile', ['Bouygues Telecom']],
    ['Syma Mobile', ['SFR']],
    ['Lebara', ['SFR']],
    ['Lycamobile', ['Bouygues Telecom']],
    ['Prixtel', ['SFR']],
    ['TeleCoop', ['Orange']],
    ['Akeo Telecom', ['Orange', 'Bouygues Telecom']],
    ['Nordnet', ['Orange']],
    ['France Téléphone', ['Orange', 'Bouygues Telecom']],
  ]);

  assert.equal(expectedNetworks.size, operatorDefinitions.length);
  for (const definition of operatorDefinitions) {
    assert.deepEqual(definition.networks, expectedNetworks.get(definition.name), definition.name);
  }
});

test('la validation normalise les réseaux et retire les produits parasites', () => {
  const definition = operatorDefinitions.find((item) => item.name === 'B&You');
  assert.ok(definition);
  const plans = validateAndNormalizePlans(definition, [
    { operator: 'faux', planName: 'Forfait 100 Go', price: 9.999, dataGb: 100, network: 'Bouygues', networkGeneration: '5g', dataEuGb: 30 },
    { operator: 'faux', planName: 'Box 4G 100 Go', price: 9.99, dataGb: 100, network: 'Bouygues' },
    { operator: 'faux', planName: 'Forfait 20 Go engagement 12 mois', price: 5, dataGb: 20, network: 'Bouygues' },
    { operator: 'faux', planName: 'Forfait impossible', price: Number.NaN, dataGb: 20, network: 'Bouygues' },
  ]);
  assert.deepEqual(plans, [{
    operator: 'B&You',
    planName: 'Forfait 100 Go',
    price: 10,
    dataGb: 100,
    calls: 'Illimités',
    network: 'Bouygues Telecom',
    networkGeneration: '5G',
    dataEuGb: 30,
  }]);
});

test('France Téléphone ignore les box et moyenne les promotions sur douze mois', () => {
  const plans = parseFranceTelephoneText(`
    5 forfaits BleuTel
    100 Go
    ESSENTIEL
    Appels, SMS & MMS illimités
    12,90 €
    /mois
    pendant 3 mois, puis 14,90 €/mois
    DÉCOUVREZ AUSSI
    BleuBox 200 Go 24,90 €
  `);
  assert.equal(plans.length, 2);
  assert.equal(plans[0].price, 14.4);
  assert.equal(plans[0].operator, 'France Téléphone');
  assert.deepEqual(plans.map((plan) => plan.network), ['Orange', 'Bouygues Telecom']);
});

test('Syma associe les colonnes prix, data et Europe sans lire les options', () => {
  const plans = parseSymaText(`
    SANS ENGAGEMENT
    7
    €99
    /MOIS
    9
    €99
    /MOIS
    illimités
    illimités
    10 Go
    10 Go
    CHOISIR
    illimités
    illimités
    100 Go
    32 Go
    CHOISIR
    Options
    100 Go
    10€
  `);
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.map((plan) => [plan.dataGb, plan.price, plan.dataEuGb]), [[10, 7.99, 10], [100, 9.99, 32]]);
});

test('TeleCoop développe les paliers fixes et exclut la facturation au Go', () => {
  const plans = parseTelecoopText('Forfait Engagé Forfait Sobriété Forfait Transition sans engagement');
  assert.equal(plans.length, 5);
  assert.ok(plans.every((plan) => !/Sobriété/i.test(plan.planName)));
});

test('Akeo retient le tarif sans réengagement sur ses deux réseaux', () => {
  const plans = parseAkeoText(`
    INFINITY
    Orange 19 € 99 / mois Engagement 12 mois 19,99 € / mois en cas de ré-engagement ou 21,99 € / mois 4G
    Bouygues Telecom 18 € 99 / mois Engagement 12 mois 18,99 € / mois en cas de ré-engagement ou 20,99 € / mois 5G
    350 Go d'internet mobile 4G ou 5G en France métropolitaine, dont 50 Go utilisables en Europe
    ULTRA
  `);
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.map((plan) => plan.price), [21.99, 20.99]);
});

test('le texte HTML retire scripts et éléments cachés', () => {
  const text = extractVisibleTextFromHtml('<body><article>Offre 100 Go</article><div hidden>Ancienne offre 20 Go</div><script>prix=1</script></body>');
  assert.match(text, /Offre 100 Go/);
  assert.doesNotMatch(text, /Ancienne|prix=1/);
});

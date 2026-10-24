import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDeviceIds, resolveConsentDebug, type ConsentDebugInput } from '../src/lib/ads/consent-debug.ts';

const base: ConsentDebugInput = {
  dev: false,
  testAdsMode: true,
  geography: undefined,
  deviceIds: undefined,
  defaultDeviceIds: ['EMULATOR'],
};

test('a release build with no env flag never sends debug settings', () => {
  assert.equal(resolveConsentDebug(base), null);
});

test('a live ads build ignores every debug flag, even in dev', () => {
  assert.equal(resolveConsentDebug({ ...base, testAdsMode: false, dev: true, geography: 'EEA' }), null);
});

test('a development client defaults to the EEA with the test devices', () => {
  assert.deepEqual(resolveConsentDebug({ ...base, dev: true, deviceIds: ' ABC123 , ,EMULATOR' }), {
    geography: 'EEA',
    testDeviceIdentifiers: ['EMULATOR', 'ABC123'],
  });
});

test('a preview build opts in with the env flag', () => {
  assert.deepEqual(resolveConsentDebug({ ...base, geography: 'eea' }), {
    geography: 'EEA',
    testDeviceIdentifiers: ['EMULATOR'],
  });
});

test('the env flag can switch debug geography off or to a non-EEA region in dev', () => {
  assert.equal(resolveConsentDebug({ ...base, dev: true, geography: 'DISABLED' }), null);
  assert.equal(resolveConsentDebug({ ...base, dev: true, geography: 'OTHER' })?.geography, 'OTHER');
});

test('an unknown geography value is ignored', () => {
  assert.equal(resolveConsentDebug({ ...base, geography: 'MARS' }), null);
});

test('device ids split on commas and drop blanks', () => {
  assert.deepEqual(parseDeviceIds(undefined), []);
  assert.deepEqual(parseDeviceIds('a, b,,c '), ['a', 'b', 'c']);
});

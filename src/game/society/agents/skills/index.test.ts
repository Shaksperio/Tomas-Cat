import assert from 'node:assert/strict';
import test from 'node:test';
import { SocietySimulation } from '../../simulation';
import { getSocietySkill, listSocietySkills, selectSkillForAgent } from './index';

test('catalog contains versioned skills for all eight professions', () => {
  const skills = listSocietySkills();
  assert.equal(skills.length, 8);
  assert.equal(new Set(skills.map((s) => s.profession)).size, 8);
  assert.ok(skills.every((s) => s.version === 1 && s.procedure.length > 0 && s.verification.length > 0));
});

test('skills expose progressive disclosure by id', () => {
  assert.equal(getSocietySkill('farmer.food-security')?.procedure[0].taskKind, 'cultivate_field');
  assert.equal(getSocietySkill('unknown'), undefined);
});

test('skill selection is deterministic and responds to resource state', () => {
  const snapshot = new SocietySimulation().snapshot();
  assert.equal(selectSkillForAgent('engineer', snapshot)?.id, 'engineer.survey-and-design');
  assert.equal(selectSkillForAgent('farmer', snapshot)?.id, 'farmer.food-security');
  const abundant = { ...snapshot, resources: { ...snapshot.resources, food: 50 } };
  assert.equal(selectSkillForAgent('farmer', abundant), undefined);
});

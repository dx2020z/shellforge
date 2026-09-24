import {mapTraits} from '../../domain/keywords';
import { findPart } from '../../domain/catalog';
import type { PartDraft } from './types';
export function generateLocalPartDraft(prompt: string, partId = 'h01'): PartDraft {
  const part = findPart(partId);
  const slot = {head:'head only, no body',body:'torso only, no head or legs',legs:'pair of legs only, no body'}[part.slot];
  const trait=mapTraits(prompt,part.slot);
  return {keywords:trait.keywords,cost:trait.cost,reasons:trait.reasons,partId, name:part.name, slot:part.slot, stats:{...part.stats}, abilityId:part.abilityId, tags:[...part.tags], description:part.description, prompt:prompt.trim(),
    visualPrompt:prompt.trim() + '. Stylized low-poly mechanical sea creature, ' + slot + ', centered isolated modular game part, no base, no text.', source:'local'};
}

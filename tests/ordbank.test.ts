import { describe, expect, it } from 'vitest'
import { buildWordInfo, classOfTag, parseCompoundProductivity, parseFullforms, parseLemmas } from '../scripts/lib/ordbank.ts'

const lemmas = [
  'LOEPENR\tLEMMA_ID\tGRUNNFORM\t\'BM_ORDBOK\'',
  '1\t10\tskog\tBM_ORDBOK',
  '2\t11\tJostein\tBM_ORDBOK',
  '3\t12\tabbed\tBM_ORDBOK',
  '4\t13\tøre\tBM_ORDBOK',
].join('\n')

const fullforms = [
  'LOEPENR\tLEMMA_ID\tOPPSLAG\tTAG\tPARADIGME_ID',
  '1\t10\tskog\tsubst mask appell ent ub normert\t1',
  '2\t10\tskogen\tsubst mask appell ent be normert\t1',
  '3\t11\tjostein\tsubst prop normert\t1',
  '4\t12\tabbed\tsubst mask appell ent ub normert\t1',
  '5\t13\tøre\tsubst nøyt appell ent ub normert\t1',
  '6\t14\tcos\tfork normert\t1',
].join('\r\n')

const compounds = [
  'LOEPENR\tLEDDANALYSE_ID\tOPPSLAG\tLEDDANALYSE\tFORLEDD\tFORLEDD_GRAM\tFUGE\tETTERLEDD',
  '1\t1\tskogsti\tx\tskog\tNoun\ts\tsti',
  '2\t2\tskogbrann\tx\tskog\tNoun\t\tbrann',
  '3\t3\tøresus\tx\tøre\tNoun\t\tsus',
  '4\t4\tskogsti\tx\tskog\tNoun\ts\tsti',
].join('\n')

describe('Norsk ordbank-lesing', () => {
  it('finner ordklassen og skiller ut egennavn', () => {
    expect(classOfTag('subst mask appell ent ub normert')).toBe('subst')
    expect(classOfTag('subst prop normert')).toBe('prop')
    expect(classOfTag('fork normert')).toBe('fork')
  })

  it('leser grunnformer med både CRLF og LF', () => {
    expect(parseLemmas(lemmas).get('10')).toBe('skog')
    expect(parseLemmas(lemmas.replace(/\n/g, '\r\n')).get('13')).toBe('øre')
  })

  it('teller hvor mange sammensatte ord et ord inngår i', () => {
    const counts = parseCompoundProductivity(compounds)
    expect(counts.get('skog')).toBe(3)
    expect(counts.get('sti')).toBe(2)
    expect(counts.get('øre')).toBe(1)
  })

  it('leser bare ønskede ord fra fullformslisten', () => {
    const forms = parseFullforms(fullforms, new Set(['skog', 'skogen']))
    expect([...forms.keys()].sort()).toEqual(['skog', 'skogen'])
    expect([...forms.get('skogen')!.classes]).toEqual(['subst'])
  })

  it('beholder bare trygge ord med grunnform og kjenthet, og bevarer æ/ø/å', () => {
    const wanted = new Set(['skog', 'skogen', 'jostein', 'abbed', 'øre', 'cos', 'ukjent'])
    const info = buildWordInfo(wanted, fullforms, lemmas, compounds)

    expect([...info.keys()].sort((first, second) => first.localeCompare(second, 'nb'))).toEqual(['abbed', 'skog', 'skogen', 'øre'])
    expect(info.get('skog')?.productivity).toBe(3)
    expect(info.get('skogen')?.lemmas).toEqual(['skog'])
    expect(info.get('skogen')?.productivity).toBe(3)
    expect(info.get('abbed')?.productivity).toBe(0)
    expect(info.get('øre')?.productivity).toBe(1)
  })
})

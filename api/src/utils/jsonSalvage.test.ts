import { describe, it, expect } from 'vitest';
import { extractJsonObject } from './jsonSalvage';

describe('jsonSalvage', () => {
  describe('extractJsonObject', () => {
    it('parses a clean JSON object (raw tier)', () => {
      expect(extractJsonObject('{"greeting":"hi","insight":"stock up"}')).toEqual({
        greeting: 'hi',
        insight: 'stock up',
      });
    });

    it('tolerates surrounding whitespace', () => {
      expect(extractJsonObject('  \n {"a":1} \n ')).toEqual({ a: 1 });
    });

    it('extracts a ```json fenced block', () => {
      const text = 'Here is your insight:\n```json\n{"greeting":"g","insight":"i"}\n```\nThanks!';
      expect(extractJsonObject(text)).toEqual({ greeting: 'g', insight: 'i' });
    });

    it('handles a fence marker glued to the previous line', () => {
      const text = 'reasoning about the bar.```json\n{"a":2}\n```';
      expect(extractJsonObject(text)).toEqual({ a: 2 });
    });

    it('recovers a bare object that follows prose (last-object tier)', () => {
      const text = 'Let me think about this. The answer is {"greeting":"hello","insight":"try a negroni"}';
      expect(extractJsonObject(text)).toEqual({ greeting: 'hello', insight: 'try a negroni' });
    });

    it('takes the LAST valid object when several appear', () => {
      const text = 'draft {"greeting":"old"} final answer {"greeting":"new","insight":"x"}';
      expect(extractJsonObject(text)).toEqual({ greeting: 'new', insight: 'x' });
    });

    it('is not confused by braces inside string values', () => {
      const text = 'note {"insight":"use 2 { and } sparingly","greeting":"g"}';
      expect(extractJsonObject(text)).toEqual({ insight: 'use 2 { and } sparingly', greeting: 'g' });
    });

    it('returns null for unparseable text', () => {
      expect(extractJsonObject('the bar is well stocked, no json here')).toBeNull();
    });

    it('returns null for non-object JSON (array / primitive)', () => {
      expect(extractJsonObject('[1,2,3]')).toBeNull();
      expect(extractJsonObject('42')).toBeNull();
      expect(extractJsonObject('"just a string"')).toBeNull();
      expect(extractJsonObject('null')).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(extractJsonObject('')).toBeNull();
      expect(extractJsonObject('   ')).toBeNull();
    });
  });
});

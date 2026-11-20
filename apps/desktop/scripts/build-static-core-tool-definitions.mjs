import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';

/** Interpret only static TypeScript data expressions; never import/execute tool factories. */
export function buildStaticCoreToolDefinitions(desktop, inputs) {
  const target = path.join(desktop, 'src/main/xiaozhi-agent/capabilities/generated/core-tool-static-definitions.json');
  const references = [...new Set([...inputs, 'package-lock.json'])].filter(file => !file.endsWith('/core-tool-static-definitions.json') && !file.endsWith('/core-tool-manifest.json')).sort();
  const fingerprint = createHash('sha256').update(fs.readFileSync(import.meta.filename));
  for (const file of references) fingerprint.update(file).update(fs.readFileSync(path.resolve(desktop, file)));
  const sourceFingerprint = fingerprint.digest('hex');
  try {const prior=JSON.parse(fs.readFileSync(target,'utf8'));if(prior.schemaVersion===1&&prior.sourceFingerprint===sourceFingerprint)return prior;} catch {}

  const files = inputs.filter(file => file.endsWith('.ts') && !file.includes('/vendor/') && !file.includes('/generated/'))
    .map(file => path.resolve(desktop, file));
  const program = ts.createProgram(files, {target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true});
  const checker = program.getTypeChecker(), evaluating = new Set(), cache = new Map();
  function value(node) {
    if (cache.has(node)) return cache.get(node);
    if (!node || evaluating.has(node)) throw Error('dynamic_or_recursive');
    evaluating.add(node);
    try {
      if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isParenthesizedExpression(node)
        || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return value(node.expression);
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
      if (ts.isNumericLiteral(node)) return Number(node.text);
      if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
      if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
      if (node.kind === ts.SyntaxKind.NullKeyword) return null;
      if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -value(node.operand);
      if (ts.isArrayLiteralExpression(node)) {const array = node.elements.flatMap(item => ts.isSpreadElement(item) ? value(item.expression) : [value(item)]); cache.set(node, array); return array;}
      if (ts.isObjectLiteralExpression(node)) {
        const object = {};
        for (const property of node.properties) {
          if (ts.isSpreadAssignment(property)) {
            const spread = value(property.expression);
            if (!spread || Array.isArray(spread) || typeof spread !== 'object') throw Error('dynamic_spread');
            Object.assign(object, spread); continue;
          }
          if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) throw Error('non_data_property');
          const key = ts.isComputedPropertyName(property.name) ? value(property.name.expression) : property.name.text;
          if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('unsafe_key');
          if (ts.isShorthandPropertyAssignment(property)) {
            const declaration = checker.getShorthandAssignmentValueSymbol(property)?.valueDeclaration;
            if (!declaration || !ts.isVariableDeclaration(declaration)) throw Error('dynamic_shorthand');
            object[key] = value(declaration.initializer);
          } else object[key] = value(property.initializer);
        }
        cache.set(node, object); return object;
      }
      if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isPropertyAccessExpression(node.expression)
        && node.expression.expression.getText() === 'Object' && node.expression.name.text === 'freeze') return value(node.arguments[0]);
      if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
        let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node);
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        const declaration = symbol?.valueDeclaration;
        if (declaration && (ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration) || ts.isEnumMember(declaration))) {
          return value(declaration.initializer);
        }
      }
      throw Error('dynamic_expression');
    } finally {evaluating.delete(node);}
  }
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const candidates = new Map(), skipped = new Set();
  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    function visit(node) {
      if (ts.isObjectLiteralExpression(node)) {
        const property = key => node.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(source).replace(/^['"]|['"]$/g, '') === key);
        const nameProperty = property('name'), parameters = property('parameters');
        if (nameProperty && parameters) {
          let name;
          try {name = value(nameProperty.initializer);} catch {}
          if (typeof name === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(name)) {
            try {
              const schema = canonical(value(parameters.initializer));
              if (!schema || schema.type !== 'object' || !schema.properties || typeof schema.properties !== 'object') throw Error('not_object_schema');
              const encoded = JSON.stringify(schema), previous = candidates.get(name);
              if (previous && previous.encoded !== encoded) skipped.add(name);
              else candidates.set(name, {name, parameters: schema, encoded});
            } catch {skipped.add(name);}
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const definitions = [...candidates.values()].filter(item => !skipped.has(item.name))
    .sort((left, right) => left.name.localeCompare(right.name)).map(({name, parameters}) => ({name, parameters}));
  const result = {schemaVersion: 1, sourceFingerprint, definitions, skippedNames: [...skipped].sort(),
    boundary: 'Static metadata only. Ambiguous or dynamic schemas are omitted; actual per-run definitions and authority remain canonical.'};
  fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n');
  return result;
}

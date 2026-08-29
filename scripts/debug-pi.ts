import { AgentConfigManager } from '../packages/core/src/index.js';
import * as fs from 'node:fs';

async function main() {
  const manager = new AgentConfigManager();
  const adapter = manager.getAgent('pi');
  if (!adapter) {
    console.error('pi not found');
    process.exit(1);
  }

  const config = await adapter.readConfig();
  const bAiProvider = config.modelProviders.find((p) => p.id === 'b.ai');
  const bAiModels = config.models.filter((m) => m.providerId === 'b.ai');

  console.log('b.ai provider:', bAiProvider ? 'found' : 'NOT FOUND');
  if (bAiProvider) {
    console.log('  baseUrl:', (bAiProvider.config as any).baseUrl);
    console.log('  apiKey set:', !!(bAiProvider.config as any).apiKey);
    console.log('  authHeader:', (bAiProvider.config as any).authHeader);
    console.log('  api:', (bAiProvider.config as any).api);
  }
  console.log('b.ai models from adapter:', bAiModels.length);
  bAiModels.forEach((m) =>
    console.log('  -', m.id, '| contextLength:', m.contextLength)
  );

  // Check what's on disk
  const disk = JSON.parse(
    fs.readFileSync(adapter.getProviderStorePath()!, 'utf-8')
  );
  const diskBAi = disk.providers?.['b.ai'];
  console.log('\nb.ai on disk:');
  console.log('  baseUrl:', diskBAi?.baseUrl);
  console.log('  model count:', diskBAi?.models?.length);
  diskBAi?.models?.forEach((m) => console.log('  -', m.id));

  // Now simulate what materializeAgent does
  const registry = await (manager as any).requireRegistry();
  const targetedProviders = registry.providers.filter((p: any) =>
    p.agentIds.includes('pi')
  );
  const registryBAi = targetedProviders.find(
    (p: any) => p.provider.id === 'b.ai'
  );
  console.log('\nRegistry b.ai for pi:', registryBAi ? 'found' : 'NOT FOUND');
  if (registryBAi) {
    console.log('  model count in registry:', registryBAi.models.length);
  }

  // The bug: materializeAgent replaces models for registry-managed providers
  // Let's see what the merged config would look like
  const registryProviderIds = new Set(
    registry.providers.map((p: any) => p.provider.id)
  );
  const mergedModels = config.models
    .filter((m: any) => !registryProviderIds.has(m.providerId))
    .concat(registryBAi?.models.map((m: any) => ({ ...m })) || []);

  const mergedBAiModels = mergedModels.filter(
    (m: any) => m.providerId === 'b.ai'
  );
  console.log(
    '\nAfter materializeAgent merge, b.ai models:',
    mergedBAiModels.length
  );
  mergedBAiModels.forEach((m: any) =>
    console.log('  -', m.id, '| contextLength:', m.contextLength)
  );
}
main();

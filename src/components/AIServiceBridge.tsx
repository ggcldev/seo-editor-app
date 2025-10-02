import { useEffect } from 'react';
import { useBus } from '@/core/BusContext';
import { aiRegistry } from '@/services/aiProviders';

export function AIServiceBridge() {
  const bus = useBus();

  useEffect(() => {
    const off = bus.on('ai:stream:request', async ({ id, prompt, providerId }) => {
      try {
        // Get the provider (use default if not specified)
        const provider = providerId
          ? aiRegistry.get(providerId) || aiRegistry.getDefault()
          : aiRegistry.getDefault();

        bus.emit('ai:stream:start', { id });

        // Stream from the provider
        for await (const chunk of provider.stream(prompt)) {
          bus.emit('ai:stream:chunk', { id, text: chunk.text });
          if (chunk.done) break;
        }

        bus.emit('ai:stream:done', { id });
      } catch (err) {
        bus.emit('ai:stream:error', {
          id,
          message: err instanceof Error ? err.message : String(err)
        });
      }
    });
    return () => off();
  }, [bus]);

  return null;
}
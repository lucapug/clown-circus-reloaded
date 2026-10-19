// Synthesized audio module (issue #11): framework-free service + pure event
// mapper. The shell injects the service through CircusGameProps.audio.
export { createAudioService } from './audioService';
export type { AudioService, AudioContextFactory, AudioContextLike } from './audioService';
export { createAudioEventMapper } from './eventMapper';
export type { AudioEventMapper } from './eventMapper';

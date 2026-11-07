// Node-side font registration for @napi-rs/canvas. Imported once by the Node renderers, before any drawing.
// The browser (Remotion) registers the same families in remotion/src/fonts.ts, using FontFace.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = (p) => path.join(ROOT, 'node_modules', '@expo-google-fonts', p);
GlobalFonts.registerFromPath(F('inter/900Black/Inter_900Black.ttf'), 'InterK');
GlobalFonts.registerFromPath(F('inter/800ExtraBold/Inter_800ExtraBold.ttf'), 'InterXB');
GlobalFonts.registerFromPath(F('inter/700Bold/Inter_700Bold.ttf'), 'InterB');
GlobalFonts.registerFromPath(F('jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'), 'MonoM');
GlobalFonts.registerFromPath(F('jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf'), 'MonoR');

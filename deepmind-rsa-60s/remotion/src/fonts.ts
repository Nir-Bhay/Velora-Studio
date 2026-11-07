// Browser-side font loading for the Remotion editor. The Node renderer registers the same families
// in render/fonts.mjs. Both must use the same family names, because film/scenes.mjs draws with them.
import {staticFile} from 'remotion';

// [family name used in the canvas, file under public/fonts, CSS weight]
const FACES: Array<[string, string, string]> = [
  ['InterK', 'fonts/Inter_900Black.ttf', '900'],
  ['InterXB', 'fonts/Inter_800ExtraBold.ttf', '800'],
  ['InterB', 'fonts/Inter_700Bold.ttf', '700'],
  ['MonoM', 'fonts/JetBrainsMono_500Medium.ttf', '500'],
  ['MonoR', 'fonts/JetBrainsMono_400Regular.ttf', '400'],
];

// Loads each face with the FontFace API and adds it to the document, so canvas text can use it.
export async function loadFonts(): Promise<void> {
  for (const [family, file, weight] of FACES) {
    const face = new FontFace(family, `url(${staticFile(file)})`, {weight});
    await face.load();
    // FontFaceSet supports add() at runtime. The TypeScript DOM typings do not declare it, so cast to Set.
    (document.fonts as unknown as Set<FontFace>).add(face);
  }
}

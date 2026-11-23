import type { DocumentStructureReference, StructureAnchor } from "../../../shared/material-document-structure";
import { neutralizePaleOverprint, overprintFocus } from "../../../shared/material-table-vision";
import { validPageBox, type PageBox } from "../../../shared/material-page-preview";

export async function readMaterialStructureCrop(reference: DocumentStructureReference, source: StructureAnchor & { rasterSha256: string }) {
  return (await readMaterialStructureCrops(reference, source, [source.box]))[0];
}

export async function readMaterialStructureCrops(reference: DocumentStructureReference,
  source: Pick<StructureAnchor, "page"> & { rasterSha256: string }, boxes: PageBox[], includeContrast = false) {
  if (!boxes.every(validPageBox)) throw Error("invalid_input");
  const png = await window.omniEdu!.getMaterialStructureImage({
    resourceId: reference.resourceId,
    version: reference.version,
    page: source.page,
    rasterSha256: source.rasterSha256,
  });
  const image = new Image();
  image.src = png;
  await image.decode();
  const crops = boxes.map(box => cropImage(image, box));
  if (includeContrast) crops.push(cropImage(image, boxes[0], true));
  return crops;
}

function cropImage(image: HTMLImageElement, [left, top, right, bottom]: PageBox, contrast = false) {
  const x = Math.floor(left * image.naturalWidth);
  const y = Math.floor(top * image.naturalHeight);
  const crop = document.createElement("canvas");
  crop.width = Math.ceil(right * image.naturalWidth) - x;
  crop.height = Math.ceil(bottom * image.naturalHeight) - y;
  const context = crop.getContext("2d");
  if (!context || !crop.width || !crop.height) throw Error("unavailable");
  context.drawImage(image, x, y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  if (contrast) {
    const pixels = context.getImageData(0, 0, crop.width, crop.height);
    neutralizePaleOverprint(pixels.data);
    const focus = overprintFocus(pixels.data, crop.width, crop.height);
    crop.width = focus.width;
    crop.height = focus.height;
    context.putImageData(pixels, -focus.x, -focus.y);
  }
  return crop.toDataURL("image/png");
}

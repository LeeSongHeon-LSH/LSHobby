// knowledge 모듈 공개 인터페이스 — 타 모듈은 이 파일을 통해서만 접근 (docs/03 §3.4)
export {
  backlinks,
  countConcepts,
  deleteConcept,
  getConcept,
  listConcepts,
  saveConcept,
  titleIndex,
  type Concept,
  type ConceptListItem,
} from "./concepts";
export { extractWikiLinks, renderWikiLinks, replaceWikiTitle } from "./wikilink";
export { uploadConceptImage } from "./images";

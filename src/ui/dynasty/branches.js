// Dynasty's 8 branches — display subset (key/label/state only) of the source
// of truth at dynasty-leads/shared/branches.mjs. The city belts live server-
// side with the capture engine; the UI only needs the dropdown list. If
// Dynasty adds a branch, update both (the engine copy is what matters).

export const BRANCHES = [
  { key: "commerce", label: "Commerce", state: "CA" },
  { key: "carson", label: "Carson", state: "CA" },
  { key: "huntington_park", label: "Huntington Park", state: "CA" },
  { key: "riverside", label: "Riverside", state: "CA" },
  { key: "ontario", label: "Ontario", state: "CA" },
  { key: "patterson", label: "Patterson", state: "CA" },
  { key: "savannah", label: "Savannah", state: "GA" },
  { key: "brooklyn", label: "Brooklyn", state: "NY" },
];

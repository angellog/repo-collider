type ShowFn = (msg: string) => void;
let fn: ShowFn = () => { return; };

export function setShowToast(f: ShowFn) {
  fn = f;
}

export function showToast(msg: string) {
  fn(msg);
}

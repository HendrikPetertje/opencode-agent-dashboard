import KSUID from "ksuid";

/** A new KSUID: 27 characters that sort alphabetically in creation order. */
export function newId(): string {
  return KSUID.randomSync().string;
}

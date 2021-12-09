// @ts-nocheck

// Obfuscate the auth token using obfuscated JS code
// Obviously not really secure, but we just want to make it hard for someone to try to use this API, but if they do it is not much of an issue,
// since it is locked down anyway
export const getAuth = () => {
  return (
    (function () {
      var Y = Array.prototype.slice.call(arguments),
        i = Y.shift();
      return Y.reverse()
        .map(function (h, p) {
          return String.fromCharCode(h - i - 18 - p);
        })
        .join("");
    })(6, 97, 116, 149, 132, 133, 112) +
    (13)
      .toString(36)
      .toLowerCase()
      .split("")
      .map(function (e) {
        return String.fromCharCode(e.charCodeAt() + -13);
      })
      .join("") +
    (16).toString(36).toLowerCase() +
    (16)
      .toString(36)
      .toLowerCase()
      .split("")
      .map(function (f) {
        return String.fromCharCode(f.charCodeAt() + -13);
      })
      .join("") +
    (1626140)
      .toString(36)
      .toLowerCase()
      .split("")
      .map(function (T) {
        return String.fromCharCode(T.charCodeAt() + -39);
      })
      .join("") +
    (function () {
      var B = Array.prototype.slice.call(arguments),
        w = B.shift();
      return B.reverse()
        .map(function (y, m) {
          return String.fromCharCode(y - w - 31 - m);
        })
        .join("");
    })(13, 129) +
    (670)
      .toString(36)
      .toLowerCase()
      .split("")
      .map(function (R) {
        return String.fromCharCode(R.charCodeAt() + -39);
      })
      .join("") +
    (12)
      .toString(36)
      .toLowerCase()
      .split("")
      .map(function (o) {
        return String.fromCharCode(o.charCodeAt() + -13);
      })
      .join("") +
    (14).toString(36).toLowerCase() +
    (1105)
      .toString(36)
      .toLowerCase()
      .split("")
      .map(function (h) {
        return String.fromCharCode(h.charCodeAt() + -39);
      })
      .join("")
  );
};

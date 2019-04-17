origDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
Object.defineProperty(document, 'cookie', {
  get() {
    return origDescriptor.get.call(this);
  },
  set(value) {
    var stack = StackTrace.getSync({offline: true});
    window.report_cookie_set(value, stack);

    return origDescriptor.set.call(this, value);
  },
  enumerable: true,
  configurable: true
});

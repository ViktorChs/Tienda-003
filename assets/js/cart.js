(function () {
    const KEY = 'gigahertz_cart_v1';
    let mem = null;

    function read() {
        if (mem) return mem;
        try {
            const raw = localStorage.getItem(KEY);
            mem = raw ? JSON.parse(raw) : [];
        } catch (e) {
            mem = [];
        }
        if (!Array.isArray(mem)) mem = [];
        return mem;
    }

    function write(items) {
        mem = items;
        try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
        window.dispatchEvent(new CustomEvent('cart:change', { detail: items }));
    }

    window.GigaCart = {
        all: function () { return read().slice(); },
        add: function (product) {
            const items = read();
            const found = items.find(function (i) { return i.id === product.id; });
            if (found) {
                found.qty = Math.min(found.qty + 1, 99);
            } else {
                items.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    img: product.img || '',
                    qty: 1
                });
            }
            write(items);
        },
        setQty: function (id, qty) {
            const items = read();
            const it = items.find(function (i) { return i.id === id; });
            if (!it) return;
            if (qty <= 0) {
                window.GigaCart.remove(id);
                return;
            }
            it.qty = Math.min(qty, 99);
            write(items);
        },
        remove: function (id) {
            write(read().filter(function (i) { return i.id !== id; }));
        },
        clear: function () { write([]); },
        count: function () {
            return read().reduce(function (s, i) { return s + i.qty; }, 0);
        },
        total: function () {
            return read().reduce(function (s, i) { return s + i.qty * i.price; }, 0);
        }
    };
})();

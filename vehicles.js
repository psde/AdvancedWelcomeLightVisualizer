const VEHICLE_CONFIGS = {
    "generic": {
        name: "Generic Channels (Grid)",
        type: "grid"
    },
    "generic_light": {
        name: "Generic Light",
        type: "image",
        image: "assets/generic_light.png",
        baseSide: "right",
        viewBox: "0 0 1000 1000",
        channels: [
            // Outer DRL (L-shape segments)
            { id: 1, type: "path", d: "M 200 450 Q 200 550 400 550", label: "Outer DRL 1" },
            { id: 2, type: "path", d: "M 220 460 Q 220 540 380 540", label: "Outer DRL 2" },
            { id: 3, type: "path", d: "M 180 440 Q 180 560 420 560", label: "Outer DRL 3" },
            { id: 4, type: "path", d: "M 240 470 Q 240 530 360 530", label: "Outer DRL 4" },

            // Inner DRL (L-shape segments)
            { id: 5, type: "path", d: "M 550 450 Q 550 550 750 550", label: "Inner DRL 1" },
            { id: 6, type: "path", d: "M 570 460 Q 570 540 730 540", label: "Inner DRL 2" },
            { id: 7, type: "path", d: "M 530 440 Q 530 560 770 560", label: "Inner DRL 3" },
            { id: 8, type: "path", d: "M 590 470 Q 590 530 710 530", label: "Inner DRL 4" },

            // Main beam modules
            { id: 9, type: "circle", cx: 350, cy: 500, r: 40, label: "Low Beam Outer" },
            { id: 10, type: "circle", cx: 650, cy: 500, r: 40, label: "Low Beam Inner" },
            { id: 11, type: "circle", cx: 500, cy: 450, r: 25, label: "Laser Accent" },
            { id: 12, type: "path", d: "M 100 400 L 900 400", label: "Upper Accent" }
        ]
    },
    "bmw_g20_2020_laser": {
        name: "BMW G20 2020 Laser",
        type: "image",
        image: "assets/generic_light.png",
        baseSide: "right",
        viewBox: "0 0 1000 1000",
        channels: [
            // Outer DRL (L-shape segments)
            { id: 1, type: "path", d: "M 200 450 Q 200 550 400 550", label: "Outer DRL 1" },
            { id: 2, type: "path", d: "M 220 460 Q 220 540 380 540", label: "Outer DRL 2" },
            { id: 3, type: "path", d: "M 180 440 Q 180 560 420 560", label: "Outer DRL 3" },
            { id: 4, type: "path", d: "M 240 470 Q 240 530 360 530", label: "Outer DRL 4" },

            // Inner DRL (L-shape segments)
            { id: 5, type: "path", d: "M 550 450 Q 550 550 750 550", label: "Inner DRL 1" },
            { id: 6, type: "path", d: "M 570 460 Q 570 540 730 540", label: "Inner DRL 2" },
            { id: 7, type: "path", d: "M 530 440 Q 530 560 770 560", label: "Inner DRL 3" },
            { id: 8, type: "path", d: "M 590 470 Q 590 530 710 530", label: "Inner DRL 4" },

            // Main beam modules
            { id: 9, type: "circle", cx: 350, cy: 500, r: 40, label: "Low Beam Outer" },
            { id: 10, type: "circle", cx: 650, cy: 500, r: 40, label: "Low Beam Inner" },
            { id: 11, type: "circle", cx: 500, cy: 450, r: 25, label: "Laser Accent" },
            { id: 12, type: "path", d: "M 100 400 L 900 400", label: "Upper Accent" }
        ]
    }
};

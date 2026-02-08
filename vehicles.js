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
        image: "assets/bmw_g20_2020_eu_laser.png",
        viewBox: "0 0 720 304",
        baseSide: "left",
        channels: [
            { id: 1,  label: "High Beam",shapes: [
                    { type: "rect", x: "209.846", y: "86.246", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "226.775", y: "87.939", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "243.85", y: "90.041", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "214.502", y: "102.328", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "231.431", y: "104.021", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "248.506", y: "106.123", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "433.349", y: "107.159", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "450.278", y: "108.852", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "467.353", y: "110.954", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "438.005", y: "123.241", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "454.934", y: "124.934", width: "15", height: "15", rx: "5", ry: "5" },
                    { type: "rect", x: "472.009", y: "127.036", width: "15", height: "15", rx: "5", ry: "5" }
                ]
            },
            { id: 2, label: "DRL", shapes: [
                    { type: "polygon", points: "106.927 73.874 129.049 78.088 113.774 96.524 164.34 162.892 184.883 175.533 312.879 183.434 324.993 195.549 192.784 188.175 171.188 181.854 142.744 164.472 95.865 115.486 85.857 94.943" },
                    { type: "polygon", points: "399.262 99.158 412.958 101.791 399.263 120.753 444.035 177.113 464.577 189.755 625.23 198.71 631.551 209.771 473.005 202.923 445.088 190.809 416.645 166.052 387.148 123.914 387.148 113.906" }
                ]
            },
            { id: 4,  label: "Low Beam",shapes: [
                    { type: "polygon", points: "192.784 82.302 265.999 89.676 277.061 121.807 214.906 116.013" },
                    { type: "polygon", points: "412.958 103.964 486.173 111.338 497.235 143.469 435.08 137.675" }
                ]
            },
            { id: 5, label: "DRL Same as Ch2", shapes: [
                    { type: "polygon", points: "106.927 73.874 129.049 78.088 113.774 96.524 164.34 162.892 184.883 175.533 312.879 183.434 324.993 195.549 192.784 188.175 171.188 181.854 142.744 164.472 95.865 115.486 85.857 94.943" },
                    { type: "polygon", points: "399.262 99.158 412.958 101.791 399.263 120.753 444.035 177.113 464.577 189.755 625.23 198.71 631.551 209.771 473.005 202.923 445.088 190.809 416.645 166.052 387.148 123.914 387.148 113.906" }
                ]
            }
        ]
    }
};

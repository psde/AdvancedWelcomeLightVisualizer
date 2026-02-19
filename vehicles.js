const VEHICLE_CONFIGS = {
    "generic": {
        name: "Generic Channels (Grid)",
        type: "grid"
    },
    "bmw_g20_2020_laser": {
        name: "BMW G20 2020 Laser",
        type: "image",
        image: "assets/bmw_g20_2020_eu_laser.png",
        viewBox: "0 0 720 304",
        baseSide: "left",
        phases: [
            { name: "Phase 1", channels: [1, 2, 4], maxDuration: 20000 },
            { name: "Phase 2", channels: [3, 5], anchor: 20000, maxDuration: null }
        ],
        defaultStates: {
            2: { brightness: 67, rampUp: 2000, rampDown: 2000 },
            4: { brightness: 46, rampUp: 2000, rampDown: 2000 }
        },
        channels: [
            { id: 1,  label: "Low Beam",shapes: [
                    { type: "polygon", points: "192.784 82.302 265.999 89.676 277.061 121.807 214.906 116.013" },
                    { type: "polygon", points: "412.958 103.964 486.173 111.338 497.235 143.469 435.08 137.675" },
                    // { type: "rect", x: "209.846", y: "86.246", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "226.775", y: "87.939", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "243.85", y: "90.041", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "214.502", y: "102.328", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "231.431", y: "104.021", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "248.506", y: "106.123", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "433.349", y: "107.159", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "450.278", y: "108.852", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "467.353", y: "110.954", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "438.005", y: "123.241", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "454.934", y: "124.934", width: "15", height: "15", rx: "5", ry: "5" },
                    // { type: "rect", x: "472.009", y: "127.036", width: "15", height: "15", rx: "5", ry: "5" }
                ]
            },
            { id: 2, label: "DRL Phase 1", shapes: [
                    { type: "polygon", points: "106.927 73.874 129.049 78.088 113.774 96.524 164.34 162.892 184.883 175.533 312.879 183.434 324.993 195.549 192.784 188.175 171.188 181.854 142.744 164.472 95.865 115.486 85.857 94.943" },
                    { type: "polygon", points: "399.262 99.158 412.958 101.791 399.263 120.753 444.035 177.113 464.577 189.755 625.23 198.71 631.551 209.771 473.005 202.923 445.088 190.809 416.645 166.052 387.148 123.914 387.148 113.906" }
                ]
            },
            { id: 3,  label: "DRL Phase 2", physicalLight: 2 },
            { id: 4,  label: "Blue Accent Phase 1", shapes: [
                    // { type: "polygon", points: "192.784 82.302 265.999 89.676 277.061 121.807 214.906 116.013" },
                    // { type: "polygon", points: "412.958 103.964 486.173 111.338 497.235 143.469 435.08 137.675" },
                    { type: "polygon", points: "148.38 97.278 154.947 97.804 186.206 126.698 192.51 129.325 260.544 128.274 255.553 131.164 191.459 132.477 179.639 128.8", color: "#0000ffba" },
                    { type: "polygon", points: "417.1 140.883 429.446 148.763 497.217 149.026 493.802 154.542 430.759 154.017 421.565 148.238", color: "#0000ffba" }
                ]
            },
            { id: 5,  label: "Blue Accent Phase 2", physicalLight: 4 }
        ]
    }
};

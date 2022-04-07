/**
 * Scriptable widget for showing GivEnergy usage data fed via Home Assistant
 * @author Daniel Gallo
 */

let widget = await createWidget();

if (!config.runsInWidget) {
    await widget.presentMedium();
}

Script.setWidget(widget);
Script.complete();

/**
 * Creates the Widget
 * @returns {Promise<ListWidget>} ListWidget
 */
async function createWidget() {
    const HOME_ASSISTANT_BASE_URL = "http://homeassistant.local";
    const HOME_ASSISTANT_ACCESS_TOKEN = "YOUR_HOME_ASSISTANT_ACCESS_TOKEN";
    const WIDGET_BACKGROUND_COLOUR = "#c7a69d";

    const SUFFIX_POWER = " kW";
    const SUFFIX_ENERGY = " kWh";
    const SUFFIX_PERCENT = "%";
    const PREFIX_CURRENCY = "£";
    const SYMBOL_SMALL = "small";
    const FONT_HEAVY = "heavy";

    const me = this;

    const request = new Request(`${HOME_ASSISTANT_BASE_URL}/api/states`);
    request.headers = {
        "Authorization": `Bearer ${HOME_ASSISTANT_ACCESS_TOKEN}`,
        "content-type": "application/json"
    };
    const data = await request.loadJSON();

    const dateFormatter = new DateFormatter();
    dateFormatter.dateFormat = "HH:mm";
    const generationDateTime = new Date();
    const rowItemLimit = 4;
    let rowItemIndex = 0;

    const items = [{
        // House usage (load)
        symbol: "house",
        attributes: [{
            entity_id: "sensor.givtcp_load_power",
            converter: convertWattsToKw,
            suffix: SUFFIX_POWER
        }, {
            entity_id: "sensor.givtcp_load_energy_today_kwh",
            suffix: SUFFIX_ENERGY,
            fontWeight: FONT_HEAVY
        }]
    }, {
        // Solar generation
        symbol: "sun.max",
        attributes: [{
            entity_id: "sensor.givtcp_pv_power",
            converter: convertWattsToKw,
            suffix: SUFFIX_POWER
        }, {
            entity_id: "sensor.givtcp_pv_energy_today_kwh",
            suffix: SUFFIX_ENERGY,
            fontWeight: FONT_HEAVY
        }]
    }, {
        // Grid
        symbol: "powerplug",
        attributes: [{
            entity_id: "sensor.givtcp_import_power",
            converter: convertWattsToKw,
            suffix: SUFFIX_POWER
        }, {
            entity_id: "sensor.givtcp_import_energy_today_kwh",
            suffix: SUFFIX_ENERGY,
            fontWeight: FONT_HEAVY
        }]
    }, {
        // Battery
        symbol: "battery",
        symbolVariants: [0, 25, 50, 75, 100],
        symbolVariantEntityId: "sensor.givtcp_soc",
        attributes: [{
            entity_id: "sensor.battery_state"
        }, {
            entity_id: "sensor.givtcp_soc",
            fontWeight: FONT_HEAVY,
            suffix: SUFFIX_PERCENT
        }]
    }, {
        // Peak costs
        label: "Peak",
        attributes: [{
            entity_id: "sensor.daily_energy_cost_peak",
            converter: convertNumberToCurrency,
            prefix: PREFIX_CURRENCY
        }, {
            entity_id: "sensor.daily_energy_peak",
            suffix: SUFFIX_ENERGY,
            fontWeight: FONT_HEAVY
        }]
    }, {
        // Off-peak costs
        label: "Off-Peak",
        attributes: [{
            entity_id: "sensor.daily_energy_cost_offpeak",
            converter: convertNumberToCurrency,
            prefix: PREFIX_CURRENCY
        }, {
            entity_id: "sensor.daily_energy_offpeak",
            suffix: SUFFIX_ENERGY,
            fontWeight: FONT_HEAVY
        }]
    }, {
        // Total costs
        label: "Total",
        attributes: [{
            entity_id: "sensor.daily_energy_cost_all",
            converter: convertNumberToCurrency,
            prefix: PREFIX_CURRENCY
        }, {
            entity_id: "sensor.givtcp_import_energy_today_kwh",
            suffix: SUFFIX_ENERGY,
            fontWeight: FONT_HEAVY
        }]
    }];

    const widget = new ListWidget();
    const nextRefresh = Date.now() + (1000 * 30); // Refresh 30 seconds from now, however iOS may prevent refreshes for several more minutes
    widget.refreshAfterDate = new Date(nextRefresh);
    widget.backgroundColor = new Color(WIDGET_BACKGROUND_COLOUR, 1);

    const headerStack = widget.addStack();
    const titleStack = headerStack.addStack();
    headerStack.addSpacer(7);

    const titleLabel = titleStack.addText("Energy Usage Today");
    titleLabel.font = Font.heavyMonospacedSystemFont(14);
    titleLabel.textColor = Color.black();

    const headerTimeStack = headerStack.addStack();
    headerTimeStack.setPadding(3, 0, 0, 0);

    // Show the time when the widget was last refreshed with data
    const timeRefreshed = headerTimeStack.addText(dateFormatter.string(generationDateTime));
    timeRefreshed.font = Font.regularMonospacedSystemFont(10);
    timeRefreshed.textColor = Color.black();

    widget.addSpacer(5);

    const bodyStack = widget.addStack();
    bodyStack.layoutVertically();
    bodyStack.centerAlignContent();
    let rowStack = null;

    let rowIndex = -1;
    let rowWidth = 320;
    let totalItemCount = items.length;
    let cellsPerRow = [];

    // Calculate how many items will be on each row
    while (totalItemCount > 0) {
        if (totalItemCount > rowItemLimit) {
            cellsPerRow.push(rowItemLimit);
            totalItemCount = totalItemCount - rowItemLimit;
        } else {
            cellsPerRow.push(totalItemCount);
            totalItemCount = 0;
        }
    }

    // Populate each of the items in the widget
    for (let item of items) {
        if (rowItemIndex === rowItemLimit) {
            rowItemIndex = 0
        }

        if (rowItemIndex === 0) {
            rowIndex++;

            rowStack = bodyStack.addStack();
            rowStack.layoutHorizontally();
            rowStack.centerAlignContent();
            rowStack.setPadding(8, 0, 0, 0);

            if (cellsPerRow[rowIndex] < rowItemLimit) {
                let spacerWidth = rowWidth / rowItemLimit;
                rowStack.addSpacer(spacerWidth / 2);
                rowWidth = rowWidth - spacerWidth;
            }
        }

        let cellStack = rowStack.addStack();

        let cellWidth = rowWidth / cellsPerRow[rowIndex];
        cellStack.size = new Size(cellWidth, 0);
        cellStack.layoutVertically();
        cellStack.topAlignContent();

        let subStack = cellStack.addStack();
        subStack.layoutHorizontally();
        subStack.addSpacer();

        // If the item has a label, show it
        if (item.label) {
            let textValue = subStack.addText(item.label);
            textValue.font = Font.heavyMonospacedSystemFont(13);
            textValue.textColor = Color.black();
            textValue.centerAlignText();
        } else {
            // Otherwise, show an icon
            let imageName = item.symbol;

            if (item.symbolVariants) {
                let attribute = data.find(element => element.entity_id === item.symbolVariantEntityId);
                let value = parseFloat(attribute.state);

                item.symbolVariants.every(rangeValue => {
                    if (value <= rangeValue) {
                        imageName = `${imageName}.${rangeValue}`;
                        return false;
                    }

                    return true;
                })
            }

            let tempIcon = SFSymbol.named(imageName).image;
            let icon = await convertToMonochrome(tempIcon);
            let img = subStack.addImage(icon);

            if (item.symbolSize === SYMBOL_SMALL) {
                img.imageSize = new Size (16, 16);
            } else {
                img.imageSize = new Size (30, 30);
            }
            img.centerAlignImage();
        }

        subStack.addSpacer();

        item.attributes.forEach(attr => {
            let attribute = data.find(element => element.entity_id === attr.entity_id);
            let text = attribute.state;

            // Format the value if a converter function has been set
            if (attr.converter) {
                text = attr.converter.call(me, text);
            }

            // Add any prefix
            if (attr.prefix) {
                text = `${attr.prefix}${text}`;
            }

            // Add any suffix
            if (attr.suffix) {
                text = `${text}${attr.suffix}`;
            }

            subStack = cellStack.addStack();
            subStack.layoutHorizontally();
            subStack.addSpacer();
            let textValue = subStack.addText(text);
            let fontSize = 12;

            // If the value is long, reduce the text size slightly to fit
            if (text.length > 9) {
                fontSize = 11;
                subStack.setPadding(0, 0, 1, 0);
            }

            if (attr.fontWeight && attr.fontWeight === FONT_HEAVY) {
                textValue.font = Font.boldMonospacedSystemFont(fontSize);
            } else {
                textValue.font = Font.regularMonospacedSystemFont(fontSize);
            }
            textValue.textColor = Color.white();
            textValue.centerAlignText();
            subStack.addSpacer();
        });

        rowItemIndex ++;
    }

    return widget;
}

/**
 * Converts Watts to Kw and returns a value to 2 decimal places
 * @param str The value to convert
 * @returns {string} Converted value in kW
 */
function convertWattsToKw(str) {
    let value = parseFloat(str);

    value = (value / 1000).toFixed(2);

    return value;
}

/**
 * Converts a number to currency format and returns a value to 2 decimal places
 * @param str The value to convert
 * @returns {string} Converted currency value with 2 decimal places
 */
function convertNumberToCurrency(str) {
    let value = parseFloat(str);

    value = value.toFixed(2);

    return value;
}

/**
 * Converts an SFSymbol to monochrome as some symbols contain colour, and it doesn't appear to be
 * possible to change the colour of these symbols via Scriptable APIs.
 * @param image The image to convert to monochrome
 * @returns {Promise<*>} Converted image
 */
async function convertToMonochrome(image) {
    const html = `<img id="image" src="data:image/png;base64,${Data.fromPNG(image).toBase64String()}" /><canvas id="canvas"></canvas>`;

    const js = `
        let img = document.getElementById("image");
        let canvas = document.getElementById("canvas");
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        let ctx = canvas.getContext("2d", { alpha: false });
        ctx.drawImage(img, 0, 0);
        
        let imgData = ctx.getImageData(0, 0, img.width, img.height);
        
        for (var i = 0; i < imgData.data.length; i+=4) {
            imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = imgData.data[i] > 200 ? 255 : 0;
        }
        
        ctx.putImageData(imgData, 0, 0);
        canvas.toDataURL("image/png").replace(/^data:image\\/png;base64,/, "");`;

    const webView = new WebView();
    await webView.loadHTML(html);
    const base64 = await webView.evaluateJavaScript(js);

    return Image.fromData(Data.fromBase64String(base64));
}
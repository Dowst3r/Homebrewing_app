// This is the single source of truth for the in-app help page and the generated PDF.
// Edit this file when you want to update the help text for a new app version.

export const helpSections = [
    {
        id: 'settings-backups',
        title: 'Colours, backups and updates',
        bodyHtml: `
        <p>Choose Light, OLED black, Pretty pink or either of your two personal palettes in Settings.</p>
        <p>Edit a palette using RGB values from 0 to 255, then choose Save and use palette.</p>
        <p>Download a JSON backup to keep your saved databases, recipes and palettes outside the app. Restore replaces saved data with the selected backup.</p>
        <p>Normal updates preserve saved data at the same address. Backups are needed when moving devices or recovering cleared storage. Unsaved forms are not included.</p>
        <p>While online, check for updates. Save your work before applying a downloaded update.</p>
    `,
    },
    {
        id: "mead-recipe",
        title: "Mead Recipe",
        image: "help/images/mead-recipe.png",
        bodyHtml: `
        <p>Use this section to calculate recipe details for your batch of homebrew.</p>
        <ul>
            <li><strong>Batch size (L)</strong>: The batch volume used by the calculation. Honey added later can increase the finished volume.</li>
            <li><strong>Target final gravity (FG)</strong>: The desired gravity after back-sweetening. The recipe assumes fermentation reaches 0.996 first.</li>
            <li><strong>Target ABV (%)</strong>: The estimated alcohol percentage before back-sweetening.</li>
            <li><strong>Honey</strong>: Selected from your Honey Database. Enter its labelled sugar concentration there.</li>
            <li><strong>Biomass yield Yₓₛ (g/g)</strong>: A model assumption for grams of dry yeast biomass per gram of sugar consumed. Default: 0.10 g/g.</li>
            <li><strong>Yeast</strong>: Selected from your Yeast Database.</li>
            <li><strong>Using Fruit?</strong> and <strong>Fruit</strong>: Recorded as notes; fruit sugar is not included in the calculation.</li>
        </ul>
        <div class="help-tip"><strong>Note:</strong> Update the Honey Database so honey mass and cost match what you use.</div>
        <p>The result gives starting gravity and Brix estimates, sugar and honey amounts, water, nutrients and an approximate back-sweetening amount.</p>
        <p>Back-sweetening uses a gravity-based estimate without a yeast-growth allowance. Add honey gradually and re-check gravity. Adding honey can dilute the ABV.</p>
        <img class="help-image" src="help/images/mead-example-output.png" alt="Example recipe output" loading="lazy">
    `,
    },
    {
        id: "abv-calculator",
        title: "ABV Calculator",
        image: "help/images/abv-calculator.png",
        bodyHtml: `
            <p>Use this screen to estimate alcohol percentage from a starting gravity and final gravity reading.</p>
            <ol>
                <li>Enter the original/starting gravity.</li>
                <li>Enter the final gravity.</li>
                <li>Press <strong>Calculate ABV</strong>.</li>
            </ol>
            <p>This is useful when checking the actual strength of a finished batch.</p>
        `,
    },
    {
        id: "time-between-dates",
        title: "Time Between Dates",
        image: "help/images/time-between-dates.png",
        bodyHtml: `
            <p>Use this screen to calculate the exact time between two dates and times.</p>
            <p>It is useful for finding the time in decimals for tracking fermentation.</p>
            <p>It can also be used for timing nutrient addition, or how long a batch has been fermenting or aging for.</p>
        `,
    },
    {
        id: "ph-adjustment",
        title: "pH Adjustment",
        image: "help/images/ph-adjustment.png",
        bodyHtml: `
            <p>Use this screen to estimate the amount of an acid or base needed to move from a starting pH to a desired pH.</p>
            <p>The calculation is theoretical, so add chemicals in small steps and re-measure.</p>
            <p>This is not typically required for homebrewing batches, however this may matter to you if you are making a batch for a competition
            <div class="help-tip"><strong>Important:</strong> Real brews are buffered, so the real-world amount may differ from what is calculated here.</div>
        `,
    },
    {
        id: "databases",
        title: "Honey, Yeast and pH Databases",
        image: "help/images/databases.png",
        bodyHtml: `
            <p>The database screens let you customise the ingredients and chemicals used by the calculators.</p>
            <ul>
                <li><strong>Honey Database</strong>: stores the honey name, sugar percentage, bottle price, and bottle mass.</li>
                <li><strong>Yeast Database</strong>: stores the yeast name, nitrogen requirement, packet weight, and packet cost.</li>
                <li><strong>pH Adjuster Database</strong>: stores the acid and base names, whether it is an acid or base, how many ions the molecule releases, the molar mass of the adjuster, and any notes for how it affects flavour.</li>
            </ul>
            <p>Saved entries are stored locally in your browser using localStorage.</p>
        `,
    },
    {
        id: "saved-recipes",
        title: "Saved Recipes",
        image: "help/images/saved-recipes.png",
        bodyHtml: `
            <p>Use this screen to view recipes you have saved from the Mead Recipe screen or added manually.</p>
            <p>You can export/print individual recipes or all saved recipes as a PDF using the export buttons.</p>
        `,
    },
];
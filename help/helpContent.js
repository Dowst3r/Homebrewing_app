// This is the single source of truth for the in-app help page and the generated PDF.
// Edit this file when you want to update the help text for a new app version.

export const helpSections = [
    {
        id: "mead-recipe",
        title: "Mead Recipe",
        image: "help/images/mead-recipe.png",
        bodyHtml: `
            <p>This section is used to calculate the recipe details for your batch of homebrew.</p>
            <ul>
                <li><strong>Batch size (L)</strong>: The final volume of your brew in litres.</li>
                <li><strong>Target final gravity (FG)</strong>: The sweetness/body you want after fermentation that comes from back-sweetening.</li>
                <li><strong>Target ABV (%)</strong>: The alcohol percentage or ABV you desire.</li>
                <li><strong>Honey</strong>: Selected from your Honey Database.</li>
                <li><strong>Yeast</strong>: Selected from your Yeast Database.</li>
                <li><strong>Using Fruit?</strong>: Currently has no function. Future functionality coming in later versions.</li>
                <li><strong>Fruit (optional)</strong>: Currently has no function. Future functionality coming in later versions.</li>
            </ul>
            <div class="help-tip"><strong>Note:</strong> Ensure that the Honey Database is updated first if you want the recipe cost and honey mass to match what you actually bought and use.</div>
        `,
        image: "/help/images/mead-example-output.png",
        bodyHtml: `
        <p>The result box re-prints the desired values, and gives the estimated starting gravity and Brix, the amount of sugar, honey, and water required. But also the yeast nutrients and honey required for backsweetening.</p>
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
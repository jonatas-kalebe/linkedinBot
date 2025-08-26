import {Page} from "puppeteer";

import selectors from "../selectors";

async function uncheckFollowCompany(page: Page) {
    const checkbox = await page.$(selectors.followCompanyCheckbox);

    if (checkbox) {
        const isChecked = await checkbox.evaluate(el => (el as HTMLInputElement).checked);
        if (isChecked) {
            await checkbox.evaluate(el => (el as HTMLInputElement).click());
            console.log('Checkbox "Seguir empresa" foi desmarcado.');
        }
    }
}

export default uncheckFollowCompany;

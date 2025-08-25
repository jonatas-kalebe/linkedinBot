import { ElementHandle, Page } from "puppeteer";

import selectors from "../selectors";

async function uncheckFollowCompany(page: Page) {
  const checkbox = null;

  if(checkbox)
    await (checkbox as ElementHandle<HTMLInputElement>).evaluate(el => el.checked && el.click());
}

export default uncheckFollowCompany;

describe('ContractTrapSpotter - E2E Demonstration Suite', () => {
  afterEach(() => {
    // 1500 ms pause between scenarios
    cy.wait(1500);
  });

  it('1. Happy path: ToS analysis, risk scoring, and in-page quote grounding', () => {
    cy.visit('/tos');
    cy.showBanner('1. Happy path: Terms Analysis & In-Page Grounding', 'Mock mode: scripted LLM output');
    cy.injectExtension();

    // Initial page & banner viewing
    cy.wait(2000);

    // Wait for content script to detect legal document and inject Analyze button
    cy.get('#cts-analyze-btn', { timeout: 8000 }).should('exist');
    // 1500 ms after the Analyze button appears
    cy.wait(1500);

    // Click Analyze button inside Shadow DOM
    cy.get('#cts-analyze-btn')
      .shadow()
      .find('#btn')
      .should('be.visible')
      .click();

    // 1500 ms after it is clicked
    cy.wait(1500);

    // Verify report panel appears in Shadow DOM
    cy.get('#cts-report-panel', { timeout: 10000 }).should('exist');

    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        // 1. Mandatory disclaimer is visible at all times
        cy.get('[data-testid="disclaimer"]')
          .should('be.visible')
          .and('contain.text', 'This tool does not provide legal advice');

        // 2. Risk score is computed deterministically and rendered
        cy.get('[data-testid="risk-score"]')
          .should('be.visible')
          .invoke('text')
          .then((text) => {
            const score = parseInt(text.trim(), 10);
            expect(score).to.be.a('number');
            expect(score).to.be.greaterThan(0);
          });

        // 3. Risk label is rendered
        cy.get('[data-testid="risk-label"]')
          .should('be.visible');

        // 4. Risky clauses are rendered with quotes and explanations
        cy.get('[data-testid="clause-item"]').should('have.length.at.least', 2);
      });

    // 3000+ ms once the report opens, so the score, label and disclaimer are readable
    cy.wait(4000);

    // Slowly scroll the report panel to show at least two clauses with their quotes, about 1500-2000 ms each
    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('[data-testid="clause-item"]')
          .eq(0)
          .scrollIntoView({ duration: 600 });
      });
    cy.wait(2000);

    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('[data-testid="clause-item"]')
          .eq(1)
          .scrollIntoView({ duration: 600 });
      });
    cy.wait(2000);

    // Click "Locate in page" on the first clause
    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('[data-testid="clause-item"]')
          .eq(0)
          .scrollIntoView({ duration: 300 });
        cy.get('[data-testid="locate-btn"]').first().click();
      });

    // Verify quote is highlighted in the page DOM
    cy.get('mark.cts-highlight', { timeout: 5000 })
      .should('exist')
      .and('be.visible');

    // 2000+ ms after Locate in page highlights a quote
    cy.wait(3000);

    // Locate in page on second clause
    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('[data-testid="clause-item"]')
          .eq(1)
          .scrollIntoView({ duration: 300 });
        cy.get('[data-testid="locate-btn"]').eq(1).click();
      });

    cy.get('mark.cts-highlight', { timeout: 5000 })
      .should('exist')
      .and('be.visible');

    cy.wait(2500);
  });

  it('2. Honest uncertainty: ambiguous legal text, ungrounded quotes & dropped claims', () => {
    cy.visit('/ambiguous');
    cy.showBanner('2. Honest uncertainty: Ungrounded Quotes & Inconclusive State', 'Mock mode: scripted LLM output');
    cy.injectExtension();

    cy.wait(2000);

    // Wait for content script button (heading mentions User Agreement)
    cy.get('#cts-analyze-btn', { timeout: 8000 }).should('exist');
    // 1500 ms after Analyze button appears
    cy.wait(1500);

    // Click Analyze button inside Shadow DOM
    cy.get('#cts-analyze-btn')
      .shadow()
      .find('#btn')
      .click();

    // 1500 ms after it is clicked
    cy.wait(1500);

    // Verify report panel appears
    cy.get('#cts-report-panel', { timeout: 10000 }).should('exist');

    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        // Disclaimer is always visible
        cy.get('[data-testid="disclaimer"]')
          .should('be.visible')
          .and('contain.text', 'This tool does not provide legal advice');

        // Score must reflect Inconclusive state
        cy.get('[data-testid="risk-label"]')
          .should('contain.text', 'Inconclusive');

        // Dropped claims notice must be clearly displayed
        cy.get('[data-testid="dropped-count"]')
          .should('be.visible')
          .and('contain.text', 'dropped because the quote could not be verified');

        // Uncertainty notices section
        cy.get('[data-testid="uncertainty-notices"]')
          .should('be.visible')
          .and('contain.text', 'Uncertainty Notices');
      });

    // 3000+ ms once the report opens, so score, label and disclaimer are readable
    cy.wait(4000);

    // 3500+ ms on the uncertainty or dropped-claims notice in the honest-uncertainty scenario
    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('[data-testid="dropped-count"]').scrollIntoView({ duration: 500 });
      });
    cy.wait(4500);

    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('[data-testid="uncertainty-notices"]').scrollIntoView({ duration: 500 });
      });
    cy.wait(4000);

    // Scroll to inconclusive score label
    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('.score-section').scrollIntoView({ duration: 500 });
      });
    cy.wait(2500);
  });

  it('3. Injection attempt: adversarial document text detected & score preserved', () => {
    cy.visit('/injection');
    cy.showBanner('3. Injection attempt: Adversarial Instructions Detected & Ignored', 'Mock mode: scripted LLM output');
    cy.injectExtension();

    cy.wait(2500);

    // Wait for Analyze button
    cy.get('#cts-analyze-btn', { timeout: 8000 }).should('exist');
    // 1500 ms after Analyze button appears
    cy.wait(1500);

    // Click Analyze button inside Shadow DOM
    cy.get('#cts-analyze-btn')
      .shadow()
      .find('#btn')
      .click();

    // 1500 ms after it is clicked
    cy.wait(1500);

    // Verify report panel appears
    cy.get('#cts-report-panel', { timeout: 10000 }).should('exist');

    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        // Disclaimer is always visible
        cy.get('[data-testid="disclaimer"]').should('be.visible');

        // Injection warnings section must be displayed
        cy.get('[data-testid="injection-warnings"]')
          .should('be.visible')
          .and('contain.text', 'Injection Attempts Detected');

        // Score must NOT be zeroed out by the injection instruction
        cy.get('[data-testid="risk-score"]')
          .invoke('text')
          .then((text) => {
            const score = parseInt(text.trim(), 10);
            expect(score).to.be.greaterThan(0);
          });
      });

    // 3000+ ms once report opens
    cy.wait(4000);

    // 3000+ ms on the injection warning and on the unchanged score
    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('[data-testid="injection-warnings"]').scrollIntoView({ duration: 500 });
      });
    cy.wait(4000);

    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('.score-section').scrollIntoView({ duration: 500 });
      });
    cy.wait(4000);

    // Scroll through clauses showing they were preserved despite injection
    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        cy.get('[data-testid="clause-item"]').first().scrollIntoView({ duration: 500 });
      });
    cy.wait(3000);
  });
});

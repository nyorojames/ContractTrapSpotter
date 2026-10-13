describe('Spec 1: Happy Path - ToS Page Analysis & Quote Highlighting', () => {
  it('detects ToS page, analyzes clauses, displays score and highlights quote in page', () => {
    cy.visit('/tos');

    // Wait for content script to detect legal document and inject Analyze button
    cy.get('#cts-analyze-btn', { timeout: 8000 }).should('exist');

    // Click Analyze button inside Shadow DOM
    cy.get('#cts-analyze-btn')
      .shadow()
      .find('#btn')
      .should('be.visible')
      .click();

    // Verify report panel appears in Shadow DOM
    cy.get('#cts-report-panel', { timeout: 10000 }).should('exist');

    cy.get('#cts-report-panel')
      .shadow()
      .within(() => {
        // 1. Mandatory disclaimer is visible at all times
        cy.get('[data-testid="disclaimer"]')
          .should('be.visible')
          .and('contain.text', 'This tool does not provide legal advice');

        // 2. Risk score is computed and rendered
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
        cy.get('[data-testid="clause-item"]').should('have.length.at.least', 1);

        cy.get('[data-testid="clause-quote"]')
          .first()
          .should('contain.text', 'Your subscription will automatically renew');

        // 5. Click "Locate in page" button
        cy.get('[data-testid="locate-btn"]').first().click();
      });

    // Verify quote is highlighted in the page DOM
    cy.get('mark.cts-highlight', { timeout: 5000 })
      .should('exist')
      .and('be.visible');
  });
});

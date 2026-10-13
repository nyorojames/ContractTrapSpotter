describe('Spec 2: Honest Uncertainty & Dropped Claims', () => {
  it('detects ambiguous/non-matching text and presents honest inconclusive state', () => {
    cy.visit('/ambiguous');

    // Wait for content script button (heading mentions User Agreement)
    cy.get('#cts-analyze-btn', { timeout: 8000 }).should('exist');

    // Click Analyze button inside Shadow DOM
    cy.get('#cts-analyze-btn')
      .shadow()
      .find('#btn')
      .click();

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
  });
});

describe('Spec 3: Prompt Injection Defense in Browser UI', () => {
  it('detects prompt injection attempt, displays warning, and preserves score', () => {
    cy.visit('/injection');

    // Wait for Analyze button
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
  });
});

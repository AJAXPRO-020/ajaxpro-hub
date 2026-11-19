// One selected fixture for template previews and PNG exports. No logo rendering here.
export const selectedMatchContext = (fixtures, fixtureKey) =>
  fixtures.find(fixture => fixture.fixture_key === fixtureKey) ?? fixtures[0] ?? null;

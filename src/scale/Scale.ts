export interface Scale<Domain, Range> {
  scale(value: Domain): Range;
  invert?(value: Range): Domain;
  domain(): Domain[];
  domain(newDomain: Domain[]): this;
  range(): Range[];
  range(newRange: Range[]): this;
}

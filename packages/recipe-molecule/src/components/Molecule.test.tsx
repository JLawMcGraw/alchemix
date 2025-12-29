/**
 * Molecule Component Tests
 *
 * Tests for the main visualization component and its sub-components.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Molecule } from './Molecule';
import { Bond } from './Bond';
import { Node } from './Node';
import { Legend } from './Legend';
import type { MoleculeRecipe, MoleculeNode, MoleculeBond } from '../core/types';

// ═══════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════

const createSpiritNode = (overrides: Partial<MoleculeNode> = {}): MoleculeNode => ({
  id: 'node-0',
  raw: '2 oz rum',
  name: 'rum',
  amount: 2,
  unit: 'oz',
  modifiers: [],
  type: 'spirit',
  color: '#64748B',
  x: 200,
  y: 150,
  radius: 18,
  label: 'RUM',
  ...overrides,
});

const createAcidNode = (overrides: Partial<MoleculeNode> = {}): MoleculeNode => ({
  id: 'node-1',
  raw: '1 oz lime juice',
  name: 'lime juice',
  amount: 1,
  unit: 'oz',
  modifiers: ['fresh'],
  type: 'acid',
  color: '#F59E0B',
  x: 260,
  y: 150,
  radius: 8,
  label: 'Ac',
  parentId: 'node-0',
  ...overrides,
});

const createSweetNode = (overrides: Partial<MoleculeNode> = {}): MoleculeNode => ({
  id: 'node-2',
  raw: '0.75 oz simple syrup',
  name: 'simple syrup',
  amount: 0.75,
  unit: 'oz',
  modifiers: [],
  type: 'sweet',
  color: '#6366F1',
  x: 300,
  y: 180,
  radius: 8,
  label: 'Sw',
  parentId: 'node-1',
  ...overrides,
});

const createGarnishNode = (overrides: Partial<MoleculeNode> = {}): MoleculeNode => ({
  id: 'node-3',
  raw: 'lime wheel',
  name: 'lime wheel',
  amount: null,
  unit: null,
  modifiers: [],
  type: 'garnish',
  color: '#10B981',
  x: 140,
  y: 150,
  radius: 8,
  label: 'Ga',
  parentId: 'node-0',
  ...overrides,
});

const createJunctionNode = (overrides: Partial<MoleculeNode> = {}): MoleculeNode => ({
  id: 'junction-0',
  raw: '',
  name: '',
  amount: null,
  unit: null,
  modifiers: [],
  type: 'junction',
  color: 'transparent',
  x: 240,
  y: 150,
  radius: 0,
  label: '',
  parentId: 'node-0',
  ...overrides,
});

const createDaiquiriRecipe = (): MoleculeRecipe => ({
  name: 'Daiquiri',
  method: 'shake · strain · coupe',
  nodes: [
    createSpiritNode(),
    createAcidNode(),
    createSweetNode(),
  ],
  bonds: [
    { from: 'node-0', to: 'node-1', type: 'single' },
    { from: 'node-1', to: 'node-2', type: 'double' },
  ],
  backbone: {
    type: 'hexagon',
    cx: 200,
    cy: 150,
    radius: 45,
  },
});

// ═══════════════════════════════════════════════════════════════
// MOLECULE COMPONENT TESTS
// ═══════════════════════════════════════════════════════════════

describe('Molecule', () => {
  it('renders without crashing', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} />);

    // Should render an SVG
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders with custom dimensions', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} width={500} height={400} />);

    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 500 400');
  });

  it('renders with display dimensions', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} displayWidth="100%" displayHeight={300} />);

    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '100%');
    expect(svg).toHaveAttribute('height', '300');
  });

  it('renders benzene rings for spirit nodes', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} />);

    // Should have line elements for benzene ring edges
    const lines = document.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders all nodes', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} />);

    // Should render text labels for all nodes
    expect(screen.getByText('RUM')).toBeInTheDocument();
    // Ac and Sw appear in both the node and legend, so use getAllByText
    expect(screen.getAllByText('Ac').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sw').length).toBeGreaterThanOrEqual(1);
  });

  it('renders bonds between nodes', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} />);

    // Bonds are rendered as lines or polygons
    const svg = document.querySelector('svg');
    const lines = svg?.querySelectorAll('line');
    expect(lines?.length).toBeGreaterThan(0);
  });

  it('shows legend when showLegend is true', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} showLegend={true} />);

    // Legend should show full type names
    expect(screen.getByText('Acid')).toBeInTheDocument();
    expect(screen.getByText('Sweet')).toBeInTheDocument();
  });

  it('hides legend when showLegend is false', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} showLegend={false} />);

    // "Acid" from legend should not be present (only "Ac" from node)
    expect(screen.queryByText('Acid')).not.toBeInTheDocument();
  });

  it('renders empty molecule gracefully', () => {
    const emptyRecipe: MoleculeRecipe = {
      name: 'Empty',
      nodes: [],
      bonds: [],
      backbone: { type: 'hexagon', cx: 200, cy: 150, radius: 45 },
    };

    render(<Molecule recipe={emptyRecipe} />);

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('uses tight viewBox when specified', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} tightViewBox={true} />);

    const svg = document.querySelector('svg');
    const viewBox = svg?.getAttribute('viewBox');
    // Tight viewBox should not start at 0 0
    expect(viewBox).not.toBe('0 0 400 300');
  });

  it('accepts svgRef prop', () => {
    const recipe = createDaiquiriRecipe();
    const ref = { current: null as SVGSVGElement | null };

    render(<Molecule recipe={recipe} svgRef={ref as React.RefObject<SVGSVGElement>} />);

    expect(ref.current).toBeInstanceOf(SVGSVGElement);
  });

  it('applies custom className', () => {
    const recipe = createDaiquiriRecipe();
    render(<Molecule recipe={recipe} className="custom-class" />);

    const container = document.querySelector('.custom-class');
    expect(container).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// NODE COMPONENT TESTS
// ═══════════════════════════════════════════════════════════════

describe('Node', () => {
  it('renders spirit node with label', () => {
    const node = createSpiritNode();
    render(
      <svg>
        <Node node={node} />
      </svg>
    );

    expect(screen.getByText('RUM')).toBeInTheDocument();
  });

  it('renders non-spirit node with abbreviation', () => {
    const node = createAcidNode();
    render(
      <svg>
        <Node node={node} />
      </svg>
    );

    expect(screen.getByText('Ac')).toBeInTheDocument();
  });

  it('does not render junction nodes', () => {
    const node = createJunctionNode();
    const { container } = render(
      <svg>
        <Node node={node} />
      </svg>
    );

    // Junction should render null - only svg wrapper
    expect(container.querySelector('g')).not.toBeInTheDocument();
  });

  it('calls onMouseEnter callback', () => {
    const node = createAcidNode();
    const handleMouseEnter = vi.fn();

    render(
      <svg>
        <Node node={node} onMouseEnter={handleMouseEnter} />
      </svg>
    );

    const group = document.querySelector('g');
    fireEvent.mouseEnter(group!);

    expect(handleMouseEnter).toHaveBeenCalledWith(
      expect.any(Object),
      node
    );
  });

  it('calls onMouseLeave callback', () => {
    const node = createAcidNode();
    const handleMouseLeave = vi.fn();

    render(
      <svg>
        <Node node={node} onMouseLeave={handleMouseLeave} />
      </svg>
    );

    const group = document.querySelector('g');
    fireEvent.mouseLeave(group!);

    expect(handleMouseLeave).toHaveBeenCalled();
  });

  it('uses smaller font for long spirit labels', () => {
    const node = createSpiritNode({ label: 'WHISKEY' });
    const { container } = render(
      <svg>
        <Node node={node} />
      </svg>
    );

    // Should apply small label class for labels > 5 chars
    const text = container.querySelector('text');
    expect(text).toBeInTheDocument();
  });

  it('renders sublabel when provided', () => {
    const node = createAcidNode({ sublabel: 'fresh' });
    render(
      <svg>
        <Node node={node} />
      </svg>
    );

    expect(screen.getByText('fresh')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// BOND COMPONENT TESTS
// ═══════════════════════════════════════════════════════════════

describe('Bond', () => {
  it('renders single bond as line', () => {
    const from = createSpiritNode();
    const to = createAcidNode();

    const { container } = render(
      <svg>
        <Bond from={from} to={to} type="single" />
      </svg>
    );

    const line = container.querySelector('line');
    expect(line).toBeInTheDocument();
  });

  it('renders double bond as two parallel lines', () => {
    const from = createAcidNode();
    const to = createSweetNode();

    const { container } = render(
      <svg>
        <Bond from={from} to={to} type="double" />
      </svg>
    );

    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(2);
  });

  it('renders dashed bond with stroke-dasharray', () => {
    const from = createSpiritNode();
    const to = createAcidNode();

    const { container } = render(
      <svg>
        <Bond from={from} to={to} type="dashed" />
      </svg>
    );

    const line = container.querySelector('line');
    expect(line).toBeInTheDocument();
  });

  it('renders wedge bond as polygon', () => {
    const from = createSpiritNode();
    const to = createGarnishNode();

    const { container } = render(
      <svg>
        <Bond from={from} to={to} type="wedge" />
      </svg>
    );

    const polygon = container.querySelector('polygon');
    expect(polygon).toBeInTheDocument();
  });

  it('renders dashedWedge bond as multiple polygons', () => {
    const from = createSpiritNode();
    const to = createAcidNode({ type: 'bitter', label: 'Bt' });

    const { container } = render(
      <svg>
        <Bond from={from} to={to} type="dashedWedge" />
      </svg>
    );

    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(3); // 3 dashes
  });

  it('handles spirit-to-spirit bonds', () => {
    const from = createSpiritNode({ id: 'node-0', x: 180, y: 150 });
    const to = createSpiritNode({ id: 'node-1', x: 220, y: 150, label: 'GIN' });

    const { container } = render(
      <svg>
        <Bond from={from} to={to} type="double" />
      </svg>
    );

    // Spirit-to-spirit uses double bond lines
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(2);
  });

  it('handles junction node bonds', () => {
    const from = createSpiritNode();
    const to = createJunctionNode();

    const { container } = render(
      <svg>
        <Bond from={from} to={to} type="single" />
      </svg>
    );

    // Should still render a line
    const line = container.querySelector('line');
    expect(line).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// LEGEND COMPONENT TESTS
// ═══════════════════════════════════════════════════════════════

describe('Legend', () => {
  it('renders abbreviations for used types', () => {
    const nodes = [createAcidNode(), createSweetNode()];

    render(<Legend nodes={nodes} />);

    expect(screen.getByText('Ac')).toBeInTheDocument();
    expect(screen.getByText('Sw')).toBeInTheDocument();
  });

  it('renders full names for types', () => {
    const nodes = [createAcidNode(), createSweetNode()];

    render(<Legend nodes={nodes} />);

    expect(screen.getByText('Acid')).toBeInTheDocument();
    expect(screen.getByText('Sweet')).toBeInTheDocument();
  });

  it('excludes spirit type from legend', () => {
    const nodes = [createSpiritNode(), createAcidNode()];

    render(<Legend nodes={nodes} />);

    // Spirit should not appear in legend
    expect(screen.queryByText('Spirit')).not.toBeInTheDocument();
    // But acid should
    expect(screen.getByText('Acid')).toBeInTheDocument();
  });

  it('excludes junction type from legend', () => {
    const nodes = [createJunctionNode(), createAcidNode()];

    render(<Legend nodes={nodes} />);

    // Only acid should appear
    expect(screen.getByText('Acid')).toBeInTheDocument();
  });

  it('returns null when no displayable types', () => {
    const nodes = [createSpiritNode()];

    const { container } = render(<Legend nodes={nodes} />);

    // Should render nothing (null)
    expect(container.firstChild).toBeNull();
  });

  it('shows types in correct order', () => {
    const nodes = [
      createGarnishNode(),
      createAcidNode(),
      createSweetNode(),
    ];

    render(<Legend nodes={nodes} />);

    // Get all legend items and check order
    const items = screen.getAllByText(/Acid|Sweet|Garnish/);
    expect(items[0]).toHaveTextContent('Acid');
    expect(items[1]).toHaveTextContent('Sweet');
    expect(items[2]).toHaveTextContent('Garnish');
  });

  it('renders title', () => {
    const nodes = [createAcidNode()];

    render(<Legend nodes={nodes} />);

    expect(screen.getByText('Recipe Chemical Structure')).toBeInTheDocument();
  });

  it('shows unique types only once', () => {
    const nodes = [
      createAcidNode({ id: 'node-1' }),
      createAcidNode({ id: 'node-2', name: 'lemon juice' }),
    ];

    render(<Legend nodes={nodes} />);

    // Should only show "Acid" once
    const acidElements = screen.getAllByText('Acid');
    expect(acidElements.length).toBe(1);
  });
});

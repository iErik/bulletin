import type {
  DateRange,
  LocalDate,
  StorageResult
} from './storage'

/** A label grouping Transactions, such as "Food". */
export interface Category {
  readonly id: number
  /** Trimmed, unique ignoring case. */
  readonly name: string
}

/** A Transaction to create. */
export interface NewTransaction {
  readonly date: LocalDate
  readonly description: string
  readonly categoryId: number
  /**
   * In centavos. Positive is Income, negative is an
   * Expense, and zero is neither.
   */
  readonly amount: number
}

/** An Expenses Entry: an amount of money on a day. */
export interface Transaction extends NewTransaction {
  readonly id: number
}

/** `window.bulletin.expenses`. */
export interface ExpensesApi {
  /** Transactions in the range, by day then id. */
  list(range: DateRange): Promise<
    StorageResult<Transaction[]>
  >
  /** Creates a Transaction. */
  create(transaction: NewTransaction): Promise<
    StorageResult<Transaction>
  >
  /** Replaces a Transaction's fields, by its `id`. */
  update(transaction: Transaction): Promise<
    StorageResult<Transaction>
  >
  /** Deletes a Transaction by its `id`. */
  delete(id: number): Promise<StorageResult<null>>
  /** Every Category, by name. */
  listCategories(): Promise<StorageResult<Category[]>>
  /**
   * Creates a Category. If one has the name, ignoring
   * case, returns that one instead.
   */
  createCategory(name: string): Promise<
    StorageResult<Category>
  >
}

/** IPC channel per `ExpensesApi` method. */
export const EXPENSES_CHANNELS = {
  list: 'expenses:list',
  create: 'expenses:create',
  update: 'expenses:update',
  delete: 'expenses:delete',
  listCategories: 'expenses:list-categories',
  createCategory: 'expenses:create-category'
} as const satisfies Record<keyof ExpensesApi, string>

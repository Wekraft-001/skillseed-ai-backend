import {
  Document,
  FilterQuery,
  Model,
  QueryOptions,
  UpdateQuery,
  SortOrder,
} from 'mongoose';

export abstract class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async findOne(
    filterQuery: FilterQuery<T>,
    projection?: Record<string, any>,
  ): Promise<T | null> {
    return this.model.findOne(filterQuery, projection).exec();
  }

  async find(
    filterQuery: FilterQuery<T>,
    projection?: Record<string, unknown>,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    return this.model.find(filterQuery, projection, options).exec();
  }

  async create(createEntityData: unknown): Promise<T> {
    const createdEntity = new this.model(createEntityData);
    return createdEntity.save();
  }

  async findOneAndUpdate(
    filterQuery: FilterQuery<T>,
    updateEntityData: UpdateQuery<T>,
  ): Promise<T | null> {
    return this.model
      .findOneAndUpdate(filterQuery, updateEntityData, { new: true })
      .exec();
  }

  async deleteMany(filterQuery: FilterQuery<T>): Promise<boolean> {
    const deleteResult = await this.model.deleteMany(filterQuery).exec();
    return deleteResult.deletedCount >= 1;
  }

  async deleteOne(filterQuery: FilterQuery<T>): Promise<boolean> {
    const deleteResult = await this.model.deleteOne(filterQuery).exec();
    return deleteResult.deletedCount === 1;
  }

  async countDocuments(filterQuery: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(filterQuery).exec();
  }

  async findWithPagination(
    filterQuery: FilterQuery<T>,
    page: number = 1,
    limit: number = 10,
    sort: Record<string, SortOrder> = { createdAt: -1 as SortOrder },
    projection?: Record<string, unknown>,
  ): Promise<{ data: T[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.model
        .find(filterQuery, projection)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filterQuery).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

}

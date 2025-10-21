'use client'

import { useOptimistic, useState } from 'react'
import { useToast } from './use-toast'

// Generic type untuk optimistic action
interface OptimisticAction<T, P = any> {
  (params: P): Promise<{ success: boolean; data?: T; error?: string }>
}

// Hook untuk optimistic updates dengan toggle functionality
export function useOptimisticToggle<T>(
  initialValue: T,
  action: OptimisticAction<T, { id: string; value: T }>,
  itemId: string
) {
  const { toast } = useToast()
  const [optimisticValue, setOptimisticValue] = useOptimistic(
    initialValue,
    (state, newValue: T) => newValue
  )
  const [isPending, setIsPending] = useState(false)

  const handleToggle = async (newValue: T) => {
    setIsPending(true)
    setOptimisticValue(newValue) // Optimistic update
    
    try {
      const result = await action({ id: itemId, value: newValue })
      
      if (!result.success) {
        // Revert on error
        setOptimisticValue(initialValue)
        toast({
          title: "Error",
          description: result.error || "Failed to update",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Success",
          description: "Updated successfully"
        })
      }
    } catch (error) {
      // Revert on error
      setOptimisticValue(initialValue)
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive"
      })
    } finally {
      setIsPending(false)
    }
  }

  return { optimisticValue, handleToggle, isPending }
}

// Hook untuk optimistic updates dengan array operations (add, remove, update)
export function useOptimisticArray<T>(
  initialArray: T[],
  action: OptimisticAction<T[], { type: 'add' | 'remove' | 'update'; item: T; id?: string }>
) {
  const { toast } = useToast()
  const [optimisticArray, setOptimisticArray] = useOptimistic(
    initialArray,
    (state, action: { type: 'add' | 'remove' | 'update'; item: T; id?: string }) => {
      switch (action.type) {
        case 'add':
          return [...state, action.item]
        case 'remove':
          return state.filter((item: any) => item.id !== action.id)
        case 'update':
          return state.map((item: any) => 
            item.id === action.id ? { ...item, ...action.item } : item
          )
        default:
          return state
      }
    }
  )
  const [isPending, setIsPending] = useState(false)

  const handleArrayAction = async (params: { type: 'add' | 'remove' | 'update'; item: T; id?: string }) => {
    setIsPending(true)
    
    try {
      const result = await action(params)
      
      if (!result.success) {
        // Revert on error - we'd need the original array for this
        toast({
          title: "Error",
          description: result.error || "Failed to update",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Success",
          description: `Item ${params.type}d successfully`
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive"
      })
    } finally {
      setIsPending(false)
    }
  }

  return { optimisticArray, handleArrayAction, isPending }
}

// Hook untuk optimistic form submission
export function useOptimisticForm<T>(
  initialValue: T,
  action: OptimisticAction<T, T>
) {
  const { toast } = useToast()
  const [optimisticValue, setOptimisticValue] = useOptimistic(
    initialValue,
    (state, newValue: T) => newValue
  )
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (values: T) => {
    setIsPending(true)
    setOptimisticValue(values) // Optimistic update
    
    try {
      const result = await action(values)
      
      if (!result.success) {
        // Revert on error
        setOptimisticValue(initialValue)
        toast({
          title: "Error",
          description: result.error || "Failed to submit",
          variant: "destructive"
        })
        return { success: false, error: result.error }
      } else {
        toast({
          title: "Success",
          description: "Submitted successfully"
        })
        return { success: true, data: result.data }
      }
    } catch (error) {
      // Revert on error
      setOptimisticValue(initialValue)
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive"
      })
      return { success: false, error: "Unknown error" }
    } finally {
      setIsPending(false)
    }
  }

  return { optimisticValue, handleSubmit, isPending }
}

// Hook untuk optimistic like functionality
export function useOptimisticLike(
  initialLikes: number,
  initialLiked: boolean,
  action: OptimisticAction<{ likes: number; liked: boolean }, { id: string; liked: boolean }>,
  itemId: string
) {
  const { toast } = useToast()
  const [optimisticState, setOptimisticState] = useOptimistic(
    { likes: initialLikes, liked: initialLiked },
    (state, newLiked: boolean) => ({
      likes: state.liked === newLiked ? state.likes : state.likes + (newLiked ? 1 : -1),
      liked: newLiked
    })
  )
  const [isPending, setIsPending] = useState(false)

  const handleLike = async () => {
    const newLiked = !optimisticState.liked
    setIsPending(true)
    setOptimisticState(newLiked) // Optimistic update
    
    try {
      const result = await action({ id: itemId, liked: newLiked })
      
      if (!result.success) {
        // Revert on error
        setOptimisticState(optimisticState.liked)
        toast({
          title: "Error",
          description: result.error || "Failed to update like",
          variant: "destructive"
        })
      }
    } catch (error) {
      // Revert on error
      setOptimisticState(optimisticState.liked)
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive"
      })
    } finally {
      setIsPending(false)
    }
  }

  return { 
    likes: optimisticState.likes, 
    liked: optimisticState.liked, 
    handleLike, 
    isPending 
  }
}

// Hook untuk optimistic delete dengan confirmation
export function useOptimisticDelete<T>(
  initialArray: T[],
  action: OptimisticAction<boolean, { id: string }>,
  itemName: string = "item"
) {
  const { toast } = useToast()
  const [optimisticArray, setOptimisticArray] = useOptimistic(
    initialArray,
    (state, deletedId: string) => state.filter((item: any) => item.id !== deletedId)
  )
  const [isPending, setIsPending] = useState(false)

  const handleDelete = async (id: string, itemName?: string) => {
    if (!confirm(`Are you sure you want to delete this ${itemName || 'item'}?`)) {
      return
    }

    setIsPending(true)
    setOptimisticArray(id) // Optimistic update
    
    try {
      const result = await action({ id })
      
      if (!result.success) {
        // Revert on error - we'd need the original array for this
        toast({
          title: "Error",
          description: result.error || "Failed to delete",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Success",
          description: `${itemName || 'Item'} deleted successfully`
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive"
      })
    } finally {
      setIsPending(false)
    }
  }

  return { optimisticArray, handleDelete, isPending }
}